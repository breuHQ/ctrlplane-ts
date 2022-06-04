import { TestEnvironment, TestPlan } from '@ctrlplane/common/models';
import { noop, Semaphore } from '@ctrlplane/common/utils';
import { WorkflowInboundLogInterceptor } from '@ctrlplane/common/workflows';
import { proxyActivities, setHandler, WorkflowInterceptorsFactory, executeChild } from '@temporalio/workflow';
import { from, map, mergeMap, Subject, take, takeUntil, tap } from 'rxjs';
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
  return new Promise((resolve, _) => {
    const queue$ = new Subject<TestPlan>(); // Streaming of incoming test plan
    const running$ = new Subject<TestPlan>(); // Stream of started test exections
    const result$ = new Subject<TestPlan>(); // Stream of test execution results
    const end$ = new Subject<void>(); // Signal to end the workflow. We want to make sure that we don't have unattended subscriptions.

    const semaphore = new Semaphore(environment.maxParallism);
    let planned: TestPlan[] = []; // List of test plans to run
    const running: TestPlan[] = []; // List of test plans currently running
    const results: TestPlan[] = []; // List of test plans that have finished

    queue$
      .pipe(
        mergeMap(plan =>
          semaphore.acquire().pipe(
            // Wait for the semaphore to be acquired before starting the test
            tap(() => running$.next(plan)), // Update the `running` list
            mergeMap(() =>
              // Run the test
              // TODO: Return the result of the test
              from(executeChild(TestRunnerWorkflow, { workflowId: `plan-${plan.id}`, args: [plan] })).pipe(
                tap(() => semaphore.release()), // Release the semaphore
                map(() => plan), // TODO: change this when we are returning the result of the test
                tap(result => results.push(result)),
              ),
            ),
          ),
        ),
        takeUntil(end$),
      )
      .subscribe();

    running$.pipe(tap(run => running.push(run))).subscribe();

    result$
      .pipe(
        takeUntil(end$),
        tap(result => {
          const idx = running.findIndex(run => run.id === result.id);
          if (idx !== -1) {
            running.splice(idx, 1);
          }
        }),
        tap(result => results.push(result)),
        tap(() => {
          if (planned.length && planned.length === results.length) {
            end$.next();
          }
        }),
      )
      .subscribe();

    end$.pipe(take(1)).subscribe(() => resolve());

    setHandler(UpdateEnvCtrlWorkflow, async signal => {
      planned = [...planned, ...signal.tests];

      for (const plan of signal.tests) {
        queue$.next(plan);
      }
    });
  });
};

export const interceptors: WorkflowInterceptorsFactory = () => ({
  inbound: [new WorkflowInboundLogInterceptor()],
});
