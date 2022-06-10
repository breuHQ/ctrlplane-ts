import { QUEUE_ENV_CTRL } from '@ctrlplane/common/names';
import { UpdateEnvCtrlWorkflow } from '@ctrlplane/workflows/signals';
import { EnvCtrlWorkflow } from '@ctrlplane/workflows/workflows';
import { Connection, WorkflowClient } from '@temporalio/client';
import { createTestEnvironments } from './generate';

const run = async () => {
  const connection = new Connection({});
  const client = new WorkflowClient(connection.service);

  const options = {
    taskQueue: QUEUE_ENV_CTRL,
  };

  const environments = createTestEnvironments(10);

  for (const env of environments) {
    await client.signalWithStart(EnvCtrlWorkflow, {
      workflowId: `env-${env.id}`,
      args: [env],
      signal: UpdateEnvCtrlWorkflow,
      signalArgs: [env],
      ...options,
    });
  }
};

run().catch(err => {
  console.error(`Workflow stopped: ${err}`);
  process.exit(1);
});
