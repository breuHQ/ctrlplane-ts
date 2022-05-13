import { proxyActivities } from '@temporalio/workflow';
import { workflowLogger as logger } from './sinks';
import type * as activities from './activities';

const activity = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
});

export async function EnvrionmentControllerWorkflow() {
  // console.info('Environment Controller Workflow started ....');
  await activity.createEnvironment();
  return;
}
