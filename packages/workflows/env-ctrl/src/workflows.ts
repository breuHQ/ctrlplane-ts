import { TestEnvironment } from '@ctrlplane/common/models';
import { logger, WorkflowInboundLogInterceptor } from '@ctrlplane/common/workflows';
import { proxyActivities, WorkflowInterceptorsFactory } from '@temporalio/workflow';
import type * as activities from './activities';
import { Semaphore } from './semaphore';

const activity = proxyActivities<typeof activities>({
  startToCloseTimeout: '60 minutes',
});

export const EnvrionmentControllerWorkflow = async (environment: TestEnvironment) => {
  const results: Array<Promise<void>> = [];
  const semaphore = new Semaphore(environment.maxParallism);
  logger.info(`Starting ... `);
  logger.info(`Total Tests ${environment.tests.length}`);
  logger.info(`Max Parralism ${environment.maxParallism}`);

  for (let i = 0; i < environment.tests.length; i++) {
    const plan = environment.tests[i];
    logger.info(`[act-${plan.id}] Scheduling [${plan.sleepSeconds}s]`);
    results.push(semaphore.fire(() => activity.createEnvironment(plan)));
  }

  // return;
  return Promise.allSettled(results).then(() => logger.debug(`Finished`));
};

export const interceptors: WorkflowInterceptorsFactory = () => ({
  inbound: [new WorkflowInboundLogInterceptor()],
});
