import { TestEnvironment, TestPlan } from '@ctrlplane/common/models';
import { noop, Semaphore } from '@ctrlplane/common/utils';
import { WorkflowInboundLogInterceptor, logger } from '@ctrlplane/common/workflows';
import { executeChild, proxyActivities, setHandler, WorkflowInterceptorsFactory } from '@temporalio/workflow';
import type * as activities from './activities';
import { TerminateTestRunnerWorkflow, UpdateEnvCtrlWorkflow } from './signals';

const { runTest } = proxyActivities<typeof activities>({
  startToCloseTimeout: '60 minutes',
});

/**
 * Test runner workflow.
 *
 * @param {TestPlan} plan The test plan to run
 * @returns {Promise<void>}
 */
export const TestRunnerWorkflow = async (plan: TestPlan): Promise<void> => {
  await runTest(plan);

  setHandler(TerminateTestRunnerWorkflow, async signal => noop());
  return;
};

/**
 * Environment Controller Workflow is the parent workflow responsible for managing the number of parallel tests
 * executions for a given customer. The workflow is meant only to be started with `signalWithStart`.
 *
 * @param {TestEnvironment} environment The environment to create
 * @return {Promise<void>}
 */
export const EnvCtrlWorkflow = async (environment: TestEnvironment): Promise<void> => {
  const results: Array<Promise<void>> = [];
  const semaphore = new Semaphore(environment.maxParallism);

  const _update = async (signal: TestEnvironment) => {
    semaphore.resize(signal.maxParallism);

    if (signal.continue) {
      for (const plan of signal.tests) {
        const workflowId = `plan-${plan.id}`;
        results.push(semaphore.fire(() => executeChild(TestRunnerWorkflow, { workflowId, args: [plan] })));
      }
    }
  };

  setHandler(UpdateEnvCtrlWorkflow, _update);

  await semaphore.awaitTerminate();
  return;
};

export const interceptors: WorkflowInterceptorsFactory = () => ({
  inbound: [new WorkflowInboundLogInterceptor()],
});
