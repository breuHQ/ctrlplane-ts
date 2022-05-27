import { TestEnvironment } from '@ctrlplane/common/models';
import { Semaphore } from '@ctrlplane/common/utils';
import {
  logger,
  UpdateEnvironmentControllerlWorkflowSignal,
  WorkflowInboundLogInterceptor,
} from '@ctrlplane/common/workflows';
import {
  CancellationScope,
  proxyActivities,
  setHandler,
  WorkflowInterceptorsFactory,
  isCancellation,
} from '@temporalio/workflow';
import type * as activities from './activities';

const activity = proxyActivities<typeof activities>({
  startToCloseTimeout: '60 minutes',
});

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
  const scope = new CancellationScope();

  // await scope.run(async () => {
  //   logger.info(`Start .... [${semaphore.max} / ${environment.tests.length}]`);

  //   setHandler(UpdateEnvironmentControllerlWorkflowSignal, async signal => {
  //     logger.info(
  //       `Updating ... [${semaphore.max} -> ${signal.maxParallism} / ${signal.tests.length}] / ${signal.continue}`,
  //     );
  //     semaphore.resize(signal.maxParallism);

  //     if (signal.continue) {
  //       for (const plan of signal.tests) {
  //         results.push(semaphore.fire(() => activity.createEnvironment(plan)));
  //       }
  //     } else {
  //       scope.cancel();
  //       logger.info('Cancelling ...');
  //     }
  //   });
  //   await semaphore.awaitTerminate();
  //   logger.info('Scope Terminated');

  //   return;
  // });

  setHandler(UpdateEnvironmentControllerlWorkflowSignal, async signal => {
    scope.run(async () => {
      semaphore.resize(signal.maxParallism);
      logger.info(
        `Updating ... [${semaphore.max} -> ${signal.maxParallism} / ${signal.tests.length}] / ${signal.continue}`,
      );
      if (signal.continue) {
        for (const plan of signal.tests) {
          results.push(semaphore.fire(() => activity.createEnvironment(plan)));
        }
      } else {
        scope.cancel();
        logger.info('Cancelling ...');
      }
      return;
    });
  });

  await semaphore.awaitTerminate();
  logger.info('Finished');
  return;
};

export const interceptors: WorkflowInterceptorsFactory = () => ({
  inbound: [new WorkflowInboundLogInterceptor()],
});
