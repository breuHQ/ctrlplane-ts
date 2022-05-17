import { TestEnvironment } from '@ctrlplane/common/models';
import { logger, WorkflowInboundLogInterceptor } from '@ctrlplane/common/workflows';
import { proxyActivities, WorkflowInterceptorsFactory } from '@temporalio/workflow';
import type * as activities from './activities';

const activity = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
});

export const EnvrionmentControllerWorkflow = async (environment: TestEnvironment) => {
  const results: Array<Promise<void>> = [];
  logger.info(`[${environment.id}] Starting ... `);
  logger.info(`[${environment.id}] Total Tests ${environment.tests.length}`);
  logger.info(`[${environment.id}] Max Parralism ${environment.maxParallism}`);
  environment.tests.forEach(plan => {
    logger.info(`Scheduling Activity [ ${plan.id}]: ${plan.sleepSeconds}s`);
    const result = activity.createEnvironment(plan);
    results.push(result);
  });

  return Promise.all(results).then(() => logger.debug(`Finished`));
};

export const interceptors: WorkflowInterceptorsFactory = () => ({
  inbound: [new WorkflowInboundLogInterceptor()],
});
