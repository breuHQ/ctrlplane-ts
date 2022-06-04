import { TestEnvironment, TestExecutionResult, TestExecutionResultStatus, TestPlan } from '@ctrlplane/common/models';
import { Semaphore } from '@ctrlplane/common/utils';
import { logger } from '@ctrlplane/common/workflows';
import { ChildWorkflowHandle, proxyActivities, setHandler, startChild } from '@temporalio/workflow';
import { from, map, mergeMap, NEVER, ReplaySubject, Subject, switchMap, take, takeUntil, tap } from 'rxjs';
import type * as activities from './activities';
import { TerminateRunTestWorkflow, UpdateEnvCtrlWorkflow } from './signals';

const { runTest, terminateTest } = proxyActivities<typeof activities>({
  startToCloseTimeout: '60 minutes',
});

interface RunTestWorkflowHandles {
  [key: string]: ChildWorkflowHandle<typeof RunTestWorkflow>;
}

/**
 * Run The Test Workflow
 *
 * @param {TestPlan} plan The test plan to run
 * @returns {Promise<void>}
 */
export const RunTestWorkflow = async (plan: TestPlan): Promise<TestExecutionResult> => {
  setHandler(TerminateRunTestWorkflow, async () => {
    logger.info('Terminating RunTestWorkflow');
    await terminateTest(plan);
  });
  const result = await runTest(plan);
  return result;
};

export const SkipTestWorkflow = async (plan: TestPlan): Promise<TestExecutionResult> => {
  return { id: plan.id, status: TestExecutionResultStatus.SKIPPED };
};

/**
 * Environment Controller Workflow is the parent workflow responsible for managing the number of parallel tests
 * executions for a given customer.
 *
 * NOTE: The workflow is meant only to be started with `signalWithStart`.
 *
 * @param {TestEnvironment} environment The environment to create
 * @return {Promise<void>}
 */
export const EnvCtrlWorkflow = async (environment: TestEnvironment): Promise<TestExecutionResult[]> => {
  return new Promise((resolve, _) => {
    /**
     * Main Exection Queue
     */
    const queue$ = new ReplaySubject<TestPlan>();
    /**
     * Waiting Queue.
     */
    const waiting$ = new ReplaySubject<TestPlan>();
    /**
     * When termination is requested, we use this subject as an indicator. In the meanwhile, we push the test plan
     * to the waiting queue.
     */
    const paused$ = new Subject<boolean>();
    paused$.next(false);
    /**
     * Stream of results
     */
    const result$ = new ReplaySubject<TestExecutionResult>();
    /**
     * Signal to end the workflow
     */
    const end$ = new Subject<void>();
    /**
     * Semaphore to control the number of parallel tests
     */
    const semaphore = new Semaphore(environment.maxParallism);
    /**
     * The total number of tests to run
     */
    let total = 0;
    let paused = false;
    /**
     * Workflow handler to signal termination
     */
    const handles: RunTestWorkflowHandles = {};
    /**
     * Test result accumulator
     */
    const results: TestExecutionResult[] = [];

    /**
     * Utility Functions
     */

    const _pause = () => {
      paused$.next(true);
      paused = true;
    };

    const _resume = () => {
      paused$.next(false);
      paused = false;
    };

    const _skitTest = (plan: TestPlan) =>
      from(startChild(SkipTestWorkflow, { workflowId: `plan-${plan.id}`, args: [plan] })).pipe(
        tap(handle => (handles[plan.id] = handle)),
      );

    const _runTest = (plan: TestPlan) =>
      from(startChild(RunTestWorkflow, { workflowId: `plan-${plan.id}`, args: [plan] })).pipe(
        tap(handle => (handles[plan.id] = handle)),
      );

    /**
     * Workflow Execution Logic
     */

    queue$
      .pipe(
        mergeMap(plan => semaphore.acquire().pipe(map(() => plan))),
        mergeMap(plan => (paused ? _skitTest(plan) : _runTest(plan))),
        mergeMap(handle => from(handle.result())),
        tap(result => result$.next(result)),
        tap(() => semaphore.release()),
        takeUntil(end$),
      )
      .subscribe();

    paused$
      .pipe(
        switchMap(paused => (paused ? NEVER : waiting$)),
        tap(plan => queue$.next(plan)),
        takeUntil(end$),
      )
      .subscribe();

    result$
      .pipe(
        tap(result => results.push(result)),
        tap(result => delete handles[result.id]),
        tap(() => total && total === results.length && end$.next()),
        takeUntil(end$),
      )
      .subscribe();

    end$.pipe(take(1)).subscribe(() => resolve(results));

    /**
     * NOTE: This workflow is only meant to be started with `signalWithStart`.
     */
    setHandler(UpdateEnvCtrlWorkflow, async signal => {
      total += signal.tests.length;
      semaphore.resize(signal.maxParallism);

      // TODO: handle the `pause` and `resume` logic
      if (!signal.continue) {
        for (const key in handles) {
          handles.hasOwnProperty(key) && handles[key].signal(TerminateRunTestWorkflow);
        }
      }

      for (const plan of signal.tests) {
        waiting$.next(plan);
      }
    });
  });
};
