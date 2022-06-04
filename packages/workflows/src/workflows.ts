import { TestEnvironment, TestPlan } from '@ctrlplane/common/models';
import { noop, Semaphore } from '@ctrlplane/common/utils';
import { WorkflowInboundLogInterceptor } from '@ctrlplane/common/workflows';
import {
  ChildWorkflowHandle,
  proxyActivities,
  setHandler,
  startChild,
  WorkflowInterceptorsFactory,
} from '@temporalio/workflow';
import { from, map, mergeMap, Subject, take, takeUntil, tap } from 'rxjs';
import type * as activities from './activities';
import { TerminateTestRunnerWorkflow, UpdateEnvCtrlWorkflow } from './signals';

const { runTest, terminateTest } = proxyActivities<typeof activities>({
  startToCloseTimeout: '60 minutes',
});

type TestRunnerWorkflowHandle = ChildWorkflowHandle<typeof TestRunnerWorkflow>;

/**
 * Test runner workflow.
 *
 * @param {TestPlan} plan The test plan to run
 * @returns {Promise<void>}
 */
export const TestRunnerWorkflow = async (plan: TestPlan): Promise<TestPlan> => {
  await runTest(plan);
  setHandler(TerminateTestRunnerWorkflow, async () => await terminateTest(plan));
  return plan;
};

/**
 * Environment Controller Workflow is the parent workflow responsible for managing the number of parallel tests
 * executions for a given customer. The workflow is meant only to be started with `signalWithStart`.
 *
 * @param {TestEnvironment} environment The environment to create
 * @return {Promise<void>}
 */
export const EnvCtrlWorkflow = async (environment: TestEnvironment): Promise<void> => {
  return new Promise((resolve, _) => {
    const queue$ = new Subject<TestPlan>(); // Streaming of incoming test plan
    const result$ = new Subject<TestPlan>(); // Stream of test execution results
    const end$ = new Subject<void>(); // Signal to end the workflow. We want to make sure that we don't have unattended subscriptions.

    const semaphore = new Semaphore(environment.maxParallism);
    let planned: TestPlan[] = []; // List of test plans to run
    const handles: TestRunnerWorkflowHandle[] = []; // Childworkflow Handles because we need to signal them later
    const results: TestPlan[] = []; // List of test plans that have finished

    setHandler(UpdateEnvCtrlWorkflow, async signal => {
      if (!signal.continue) {
        for (const handle of handles) {
          handle.signal(TerminateTestRunnerWorkflow);
        }
      }

      planned = [...planned, ...signal.tests];

      for (const plan of signal.tests) {
        queue$.next(plan);
      }
    });

    queue$
      .pipe(
        mergeMap(plan => semaphore.acquire().pipe(map(() => plan))),
        mergeMap(plan => from(startChild(TestRunnerWorkflow, { workflowId: `plan-${plan.id}`, args: [plan] }))),
        tap(handle => handles.push(handle)),
        mergeMap(handle => from(handle.result())),
        tap(result => result$.next(result)),
        tap(() => semaphore.release()),
        takeUntil(end$),
      )
      .subscribe();

    result$
      .pipe(
        tap(result => results.push(result)),
        // If we have all the results, we can signal the end of the workflow
        tap(() => planned.length && planned.length === results.length && end$.next()),
        takeUntil(end$),
      )
      .subscribe();

    // Resolve the promise when the workflow ends
    end$.pipe(take(1)).subscribe(() => resolve());
  });
};

export const interceptors: WorkflowInterceptorsFactory = () => ({
  inbound: [new WorkflowInboundLogInterceptor()],
});
