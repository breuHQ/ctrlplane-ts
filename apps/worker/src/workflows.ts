import { WorkflowInterceptorsFactory } from '@temporalio/workflow';
import { WorkflowInboundLogInterceptor } from '@ctrlplane/common/workflows';
export { EnvCtrlWorkflow, TestRunnerWorkflow } from '@ctrlplane/workflows/workflows';

export const interceptors: WorkflowInterceptorsFactory = () => ({
  inbound: [new WorkflowInboundLogInterceptor()],
});
