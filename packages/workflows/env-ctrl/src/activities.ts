import { getContext } from '@ctrlplane/common/activities';
import { TestPlan } from '@ctrlplane/common/models';
import { sleep } from '@ctrlplane/common/utils';

export const createEnvironment: (plan: TestPlan) => Promise<void> = async plan => {
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
