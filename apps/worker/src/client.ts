import { Connection, WorkflowClient, WorkflowStartOptions } from '@temporalio/client';
import { EnvrionmentControllerWorkflow } from '@ctrlplane/workflows/env-ctrl/workflows';
import { nanoid } from 'nanoid';

const runWorkflow = async () => {
  const connection = new Connection({});
  const client = new WorkflowClient(connection.service);

  const options: WorkflowStartOptions = {
    workflowId: `environment-id-${nanoid()}`, // TODO: This should be environment ID
    taskQueue: 'env-ctrl-wf',
  };

  const workflow = await client.start(EnvrionmentControllerWorkflow, options);
  console.log(`Environment Controller Workflow scheduled ....: ${workflow.workflowId}`);

  await workflow.result();
};

runWorkflow().catch(err => {
  console.error(`Workflow stopped: ${err}`);
  process.exit(1);
});
