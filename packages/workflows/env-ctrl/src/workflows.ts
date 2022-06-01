import { TestEnvironment, TestPlan } from '@ctrlplane/common/models';
import { UpdateEnvironmentControllerlWorkflowSignal } from '@ctrlplane/common/signals';
import { Semaphore } from '@ctrlplane/common/utils';
import { logger, WorkflowInboundLogInterceptor } from '@ctrlplane/common/workflows';
import { executeChild, proxyActivities, setHandler, WorkflowInterceptorsFactory } from '@temporalio/workflow';
import type * as activities from './activities';

const { runTest } = proxyActivities<typeof activities>({
  startToCloseTimeout: '60 minutes',
});

export const TestRunnerWorkflow = async (plan: TestPlan): Promise<void> => {
  logger.info(`Start [${plan.sleepSeconds}s]`);
  await runTest(plan);
  logger.info(`End [${plan.sleepSeconds}s]`);
  return;
};

/**
 * Environment Controller Workflow is the parent workflow responsible for managing the number of parallel tests
 * executions for a given customer. The workflow is meant only to be started with `signalWithStart`.
 *
 * @param {TestEnvironment} environment The environment to create
 * @return {Promise<void>}
 */
export const EnvrionmentControllerWorkflow = async (environment: TestEnvironment): Promise<void> => {
  const results: Array<Promise<void>> = [];
  const semaphore = new Semaphore(environment.maxParallism);

  setHandler(UpdateEnvironmentControllerlWorkflowSignal, async signal => {
    const info = `Updating ... [${semaphore.max} -> ${signal.maxParallism} / ${signal.tests.length}] / ${signal.continue}`;
    logger.info(info);
    semaphore.resize(signal.maxParallism);
    for (const plan of signal.tests) {
      const workflowId = `plan-${plan.id}`;
      logger.info(`Scheduling Test ... [${workflowId}]`);
      results.push(semaphore.fire(() => executeChild(TestRunnerWorkflow, { workflowId, args: [plan] })));
    }
  });

  await semaphore.awaitTerminate();
  logger.info('Finished ...');
  return;
};

export const interceptors: WorkflowInterceptorsFactory = () => ({
  inbound: [new WorkflowInboundLogInterceptor()],
});
