import { TestEnvironment, TestExecutionResult, TestExecutionResultStatus, TestPlan } from '@ctrlplane/common/models';
import { Semaphore } from '@ctrlplane/common/utils';
import { logger } from '@ctrlplane/common/workflows';
import { ChildWorkflowHandle, proxyActivities, setHandler, startChild } from '@temporalio/workflow';
import { from, map, mergeMap, ReplaySubject, Subject, take, takeUntil, tap } from 'rxjs';
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
  });
  const result = await runTest(plan);
  return result;
};

export const SkilTestWorkflow = async (plan: TestPlan): Promise<TestExecutionResult> => {
  return { id: plan.id, status: TestExecutionResultStatus.SKIPPED };
};

/**
 * Environment Controller Workflow is the parent workflow responsible for managing the number of parallel tests
 * executions for a given customer. The workflow is meant only to be started with `signalWithStart`.
 *
 * @param {TestEnvironment} environment The environment to create
 * @return {Promise<void>}
 */
export const EnvCtrlWorkflow = async (environment: TestEnvironment): Promise<TestExecutionResult[]> => {
  return new Promise((resolve, _) => {
    /**
     * Streaming of test plans to process
     */
    const queue$ = new ReplaySubject<TestPlan>();
    /**
     * Stream of results
     */
    const result$ = new ReplaySubject<TestExecutionResult>(); // Stream of test execution results
    /**
     * Signal to end the workflow
     */
    const end$ = new Subject<void>();
    const semaphore = new Semaphore(environment.maxParallism);
    let total = 0;
    const handles: RunTestWorkflowHandles = {}; // Childworkflow Handles because we need to signal them later
    const results: TestExecutionResult[] = []; // List of test plans that have finished

    queue$
      .pipe(
        mergeMap(plan => semaphore.acquire().pipe(map(() => plan))),
        mergeMap(plan =>
          from(startChild(RunTestWorkflow, { workflowId: `plan-${plan.id}`, args: [plan] })).pipe(
            tap(handle => (handles[plan.id] = handle)),
          ),
        ),
        mergeMap(handle => from(handle.result())),
        tap(result => result$.next(result)),
        tap(() => semaphore.release()),
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

    // Resolve the promise when the workflow ends
    end$.pipe(take(1)).subscribe(() => resolve(results));

    setHandler(UpdateEnvCtrlWorkflow, async signal => {
      total += signal.tests.length;
      semaphore.resize(signal.maxParallism);

      if (!signal.continue) {
        for (const key in handles) {
          handles.hasOwnProperty(key) && handles[key].signal(TerminateRunTestWorkflow);
        }
      }

      for (const plan of signal.tests) {
        queue$.next(plan);
      }
    });
  });
};
