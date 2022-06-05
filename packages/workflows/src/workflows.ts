import { TestEnvironment, TestExecutionResult, TestExecutionResultStatus, TestPlan } from '@ctrlplane/common/models';
import { Semaphore } from '@ctrlplane/common/utils';
import { logger } from '@ctrlplane/common/workflows';
import { ChildWorkflowHandle, proxyActivities, setHandler, sleep, startChild } from '@temporalio/workflow';
import {
  bufferToggle,
  distinctUntilChanged,
  filter,
  from,
  map,
  merge,
  mergeMap,
  ReplaySubject,
  share,
  take,
  takeUntil,
  tap,
  windowToggle,
} from 'rxjs';
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
  // setHandler(TerminateRunTestWorkflow, async () => {
  //   logger.info('Terminating RunTestWorkflow');
  //   await terminateTest(plan);
  // });
  // const result = await runTest(plan);
  // return result;
  return new Promise((resolve, _) => {
    setHandler(TerminateRunTestWorkflow, () => {
      logger.info(`Terminate`);
      resolve({ id: plan.id, status: TestExecutionResultStatus.TERMINATED });
    });
    sleep(plan.sleepSeconds * 1000).then(() => resolve({ id: plan.id, status: TestExecutionResultStatus.SUCCESS }));
  });
};

export const SkipTestWorkflow = async (plan: TestPlan): Promise<TestExecutionResult> => {
  return new Promise((resolve, _) => {
    logger.info('Skipping test');
    resolve({ id: plan.id, status: TestExecutionResultStatus.SKIPPED });
  });
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
     * Semaphore to control the number of parallel tests
     */
    const semaphore = new Semaphore(environment.maxParallism);

    /**
     * Workflow handler to signal termination
     */
    const handles: RunTestWorkflowHandles = {};

    /**
     * Test result accumulator
     */
    const results: TestExecutionResult[] = [];

    /**
     * The total number of tests to run
     */
    let total = 0;
    let paused = 0;

    /**
     * Main Exection Queue
     */
    const queue$ = new ReplaySubject<TestPlan>();

    /**
     * Waiting Queue. By default, all tests are pushed to this queue.
     */
    const waiting$ = new ReplaySubject<TestPlan>();

    /**
     * Stream of results
     */
    const result$ = new ReplaySubject<TestExecutionResult>();

    /**
     * Signal to end the workflow
     */
    const end$ = new ReplaySubject<void>();

    /**
     * Signals for pause and resume.
     */
    const pause$ = new ReplaySubject<boolean>();

    const _pause$ = pause$.pipe(distinctUntilChanged(), share());
    const _on$ = _pause$.pipe(
      filter(v => !v),
      tap(() => (total += paused)),
      tap(() => (paused = 0)),
    );
    const _off$ = _pause$.pipe(filter(v => !!v));

    /**
     * Utility Functions
     */

    const _skipTest = (plan: TestPlan) =>
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

    // Initiating the pause and resume logic
    merge(
      waiting$.pipe(
        bufferToggle(_off$, () => _on$),
        mergeMap(x => x),
      ),
      waiting$.pipe(
        windowToggle(_on$, () => _off$),
        mergeMap(x => x),
      ),
    )
      .pipe(tap(plan => queue$.next(plan)))
      .subscribe();

    pause$.next(true);
    pause$.next(false);

    queue$
      .pipe(
        mergeMap(plan => semaphore.acquire().pipe(map(() => plan))),
        mergeMap(plan => (paused ? _skipTest(plan) : _runTest(plan))),
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
        tap(() => logger.info(`${paused} + ${total} ? ${results.length}`)),
        tap(() => logger.info(`Ending: ${total && total === results.length && !!(paused === 0)}`)),
        tap(() => logger.info(`Resume: ${total && total === results.length && !!(paused > 0)}`)),
        tap(() => total && total === results.length && !!(paused === 0) && end$.next()),
        tap(() => total && total === results.length && !!(paused > 0) && pause$.next(false)),
        takeUntil(end$),
      )
      .subscribe();

    end$.pipe(take(1)).subscribe(() => resolve(results));

    /**
     * NOTE: This workflow is only meant to be started with `signalWithStart`.
     */
    setHandler(UpdateEnvCtrlWorkflow, async signal => {
      semaphore.resize(signal.maxParallism);

      // TODO: handle the `pause` and `resume` logic
      if (signal.continue && total === 0 && paused === 0) {
        logger.info(`Continue: ${paused} -> ${signal.continue}`);
        total += signal.tests.length;
      } else {
        logger.info(`Pause: ${paused} -> ${signal.continue}`);
        pause$.next(true);
        paused += signal.tests.length;
        for (const key in handles) {
          if (handles.hasOwnProperty(key)) {
            handles[key].signal(TerminateRunTestWorkflow);
          }
        }
      }

      for (const plan of signal.tests) {
        queue$.next(plan);
      }
    });
  });
};
