import { proxyActivities } from '@temporalio/workflow';
import type * as activities from './activities';

const activity = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
});

export async function envrionmentControllerWorkflow() {
  await activity.createEnvironment();
}
