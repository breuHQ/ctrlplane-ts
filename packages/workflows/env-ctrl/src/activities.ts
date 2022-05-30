import { getContext } from '@ctrlplane/common/activities';
import { TestPlan } from '@ctrlplane/common/models';
import { sleep } from '@ctrlplane/common/utils';

export const runTest: (plan: TestPlan) => Promise<void> = async plan => {
  const ctx = getContext();
  ctx.logger.info(
    `[${ctx.info.workflowType}] [${ctx.info.workflowExecution.workflowId}] Start ... [${plan.sleepSeconds}s]`,
  );
  for (let secs = 0; secs < plan.sleepSeconds; secs++) {
    await sleep(1000);
    ctx.heartbeat();
  }
  ctx.logger.info(
    `[${ctx.info.workflowType}] [${ctx.info.workflowExecution.workflowId}] End ... [${plan.sleepSeconds}s]`,
  );

  return;
};
