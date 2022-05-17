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

export const createEnvironment = async (plan: TestPlan) => {
  const context = getContext();
  context.logger.info(
    `[${context.info.workflowType}] [${context.info.workflowExecution.workflowId}] [act-${plan.id}]: Starting [${plan.sleepSeconds}s] ... `,
  );
  await sleep(plan.sleepSeconds * 1000);
  context.logger.info(
    `[${context.info.workflowType}] [${context.info.workflowExecution.workflowId}] [act-${plan.id}]: Finished ${plan.sleepSeconds}s`,
  );
  return;
};
