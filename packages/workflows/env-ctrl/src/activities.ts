import { getContext } from '@ctrlplane/common/activities';
import { TestPlan } from '@ctrlplane/common/models';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// export async function createEnvironment() {
//   const context = getContext();
//   const seconds: number = Math.random() * 10;
//   context.logger.info(
//     `[${context.info.workflowType}] [${context.info.workflowExecution.workflowId}]: Activity will sleep for ${seconds} seconds`,
//   );
//   await sleep(seconds * 1000);
//   return;
// }

export const createEnvironment: (p: TestPlan) => Promise<void> = async (plan: TestPlan) => {
  const context = getContext();
  context.logger.info(
    `[${context.info.workflowType}] [${context.info.workflowExecution.workflowId}] [act-${plan.id}]: Start [${plan.sleepSeconds}s]`,
  );
  for (let secs = 0; secs < plan.sleepSeconds; secs++) {
    await sleep(1000);
    context.heartbeat();
  }
  context.logger.info(
    `[${context.info.workflowType}] [${context.info.workflowExecution.workflowId}] [act-${plan.id}]: End [${plan.sleepSeconds}s]`,
  );
  return;
};
