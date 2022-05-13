import { getContext } from './interceptors';

export async function createEnvironment() {
  const context = await getContext();
  console.log(`Environment Controller Workflow [${context.info.workflowExecution.workflowId}]: Activity Running .... `);
  return;
}
