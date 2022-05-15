import { logger, WorkflowInboundLogInterceptor } from '@ctrlplane/workflows/common/workflows';
import { proxyActivities, WorkflowInterceptorsFactory } from '@temporalio/workflow';
import type * as activities from './activities';

const activity = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
});

export const EnvrionmentControllerWorkflow = async () => {
  logger.info('Scheduling Activity');
  await activity.createEnvironment();
  return;
};

export const interceptors: WorkflowInterceptorsFactory = () => ({
  inbound: [new WorkflowInboundLogInterceptor()],
});
