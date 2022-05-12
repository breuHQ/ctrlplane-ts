import { proxyActivities } from '@temporalio/workflow';
import { workflowLogger as logger } from './sinks';
import type * as activities from './activities';

const activity = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
});

export async function EnvrionmentControllerWorkflow() {
  logger.info('Starting environment controller workflow');
  await activity.createEnvironment();
}
