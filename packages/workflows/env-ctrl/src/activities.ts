import { getContext } from '@ctrlplane/workflows/common/activities';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function createEnvironment() {
  const context = getContext();
  const seconds: number = Math.random() * 10;
  context.logger.info(`[${context.info.workflowExecution.workflowId}]: Activity will sleep for ${seconds} seconds`);
  await sleep(seconds * 10 * 1000);
  return;
}
