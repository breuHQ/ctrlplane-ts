import { EnvrionmentControllerWorkflow } from '@ctrlplane/workflows/env-ctrl/workflows';
import { QUEUE_ENV_CTRL } from '@ctrlplane/common/names';
import { Connection, WorkflowClient } from '@temporalio/client';
import { createTestEnvironments } from './generate';
import { UpdateEnvironmentControllerlWorkflowSignal } from '@ctrlplane/common/workflows';

const run = async () => {
  const connection = new Connection({});
  const client = new WorkflowClient(connection.service);

  const options = {
    taskQueue: QUEUE_ENV_CTRL,
  };

  const testEnvironments = createTestEnvironments(50);

  for (const env of testEnvironments) {
    // await client.start(EnvrionmentControllerWorkflow, {
    //   workflowId: `env-${env.id}`,
    //   args: [env],
    //   ...options,
    // });
    await client.signalWithStart(EnvrionmentControllerWorkflow, {
      workflowId: `env-${env.id}`,
      args: [env],
      signal: UpdateEnvironmentControllerlWorkflowSignal,
      signalArgs: [env],
      ...options,
    });
  }

  // for (const env of testEnvironments) {
  //   const handle = client.getHandle(`env-${env.id}`);
  //   await handle.signal(UpdateEnvironmentControllerlWorkflowSignal, env);
  // }
};

run().catch(err => {
  console.error(`Workflow stopped: ${err}`);
  process.exit(1);
});
