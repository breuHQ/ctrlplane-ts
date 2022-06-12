import { TestEnvironment, TestExecutionResult, TestExecutionResultStatus, TestPlan } from '@ctrlplane/common/models';
import { Semaphore } from '@ctrlplane/common/utils/semaphore';
import { logger } from '@ctrlplane/common/workflows';
import { executeChild, proxyActivities, setHandler, startChild } from '@temporalio/workflow';
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
  Subject,
  take,
  takeUntil,
  tap,
  windowToggle,
} from 'rxjs';
import type * as activities from './activities';
import { UpdateEnvCtrlWorkflow } from './signals';

const { runTest, terminateEnvironmentTests } = proxyActivities<typeof activities>({
  startToCloseTimeout: '60 minutes',
});

/**
 * Environment Controller Workflow is the parent workflow responsible for managing the number of parallel tests
 * executions for a given customer.
 *
 * NOTE: The workflow is meant only to be started with `signalWithStart`.
 *
 * @param {TestEnvironment} environment - The environment to create
 * @return {Promise<void>}
 */
export const EnvCtrlWorkflow = async (environment: TestEnvironment): Promise<TestExecutionResult[]> => {
  return new Promise(resolve => {
    /**
     * Semaphore to control the number of parallel tests
     */
    const semaphore = new Semaphore(environment.maxParallism);

    /**
     * Test result accumulator
     */
    const results: TestExecutionResult[] = [];

    /**
     * The total number of tests to run
     */
    let total = 0;
    let paused = 0;
    let terminationCounter = 0;

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
    const pause$ = new Subject<boolean>();

    const _pause$ = pause$.pipe(distinctUntilChanged(), share());
    const _on$ = _pause$.pipe(
      filter(v => !v),
      tap(() => (total += paused)),
      tap(() => (paused = 0)),
      tap(() => logger.info(`Resuming ...`)),
    );
    const _off$ = _pause$.pipe(
      filter(v => !!v),
      tap(() => logger.info(`Pausing ...`)),
    );

    /**
     * Utility Functions
     */

    const _skipTest = (plan: TestPlan) =>
      from(executeChild(SkipTestWorkflow, { workflowId: `${plan.id}`, args: [plan] }));

    const _runTest = (plan: TestPlan) =>
      from(executeChild(RunTestWorkflow, { workflowId: `${plan.id}`, args: [plan] }));

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
        tap(plan => logger.info(`[${plan.id}] Slot Acquired`)),
        mergeMap(plan => (paused ? _skipTest(plan) : _runTest(plan))),
        tap(result => result$.next(result)),
        tap(() => semaphore.release()),
        tap(result => logger.info(`[${result.id}] [${result.status}] Slot Released ...`)),
        takeUntil(end$),
      )
      .subscribe();

    result$
      .pipe(
        tap(result => results.push(result)),
        tap(() => !paused && total && total === results.length && end$.next()),
        tap(() => paused && total && total === results.length && pause$.next(false)),
        takeUntil(end$),
      )
      .subscribe();

    end$
      .pipe(
        take(1),
        tap(() => logger.info(`Finished`)),
      )
      .subscribe(() => resolve(results));

    /**
     * NOTE: This workflow is only meant to be started with `signalWithStart`.
     */
    setHandler(UpdateEnvCtrlWorkflow, async signal => {
      logger.info(`Received Signal ..`);
      logger.info(`Resizing Sempahore to ${semaphore.max} -> ${signal.maxParallism}`);
      semaphore.resize(signal.maxParallism);

      if (paused === 0 && total === 0 && results.length === 0) {
        total += signal.tests.length;
      } else {
        if (paused === 0 && signal.continue) {
          total += signal.tests.length;
        } else {
          logger.info(`Skipping tests ...`);
          paused += signal.tests.length;
          pause$.next(true); // This will stop the `queue`.
          startChild(TermiateEnvironmentTestsWorkflow, {
            workflowId: `${environment.id}-${terminationCounter}`, // TODO: We need to comeup with a better way to generate ID
            args: [environment],
          });
          terminationCounter++;
        }
      }

      for (const plan of signal.tests) {
        logger.info(`[${plan.id}] Adding to Queue`);
        waiting$.next(plan);
      }
    });
  });
};

/**
 * Run The Test Workflow
 *
 * @param {TestPlan} plan - The test plan to run
 * @returns {Promise<TestExecutionResult>} The test execution result
 */
export const RunTestWorkflow = async (plan: TestPlan): Promise<TestExecutionResult> => {
  logger.info(`Running Test ...`);
  const result = await runTest(plan);
  return result;
};

/**
 * Skip Running the tests. We just update the status of the test to `skipped`.
 *
 * @param {TestPlan} plan - The test plan to run
 * @returns {Promise<TestExecutionResult>} The test execution result
 */
export const SkipTestWorkflow = async (plan: TestPlan): Promise<TestExecutionResult> => {
  logger.info(`Skipping Test ...`);
  return new Promise(resolve => resolve({ id: plan.id, status: TestExecutionResultStatus.SKIPPED }));
};

/**
 * Terminates all tests running in environment
 *
 * @param {TestEnvironment} environment - The environment which we want to terminate
 * @returns
 */
export const TermiateEnvironmentTestsWorkflow = async (environment: TestEnvironment): Promise<void> => {
  logger.info(`Terminating All Tests ...`);
  return terminateEnvironmentTests(environment);
};
