import { EnvrionmentControllerWorkflow } from '@ctrlplane/workflows/env-ctrl/workflows';
import { Connection, WorkflowClient } from '@temporalio/client';
import { testEnvironmentFactory } from './generate';

const runWorkflow = async () => {
  const connection = new Connection({});
  const client = new WorkflowClient(connection.service);

  const options = {
    taskQueue: 'env-ctrl-wf',
  };

  const testEnvironments = testEnvironmentFactory.buildList(10);

  testEnvironments.forEach(environemnt => {
    client.start(EnvrionmentControllerWorkflow, {
      workflowId: `env-${environemnt.id}`,
      args: [environemnt],
      ...options,
    });
  });
};

runWorkflow().catch(err => {
  console.error(`Workflow stopped: ${err}`);
  process.exit(1);
});
