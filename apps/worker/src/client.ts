import { EnvrionmentControllerWorkflow } from '@ctrlplane/workflows/env-ctrl/workflows';
import { Connection, WorkflowClient } from '@temporalio/client';
import { nanoid } from 'nanoid';
import { interval, take } from 'rxjs';

const runWorkflow = async () => {
  const connection = new Connection({});
  const client = new WorkflowClient(connection.service);

  const options = {
    // workflowId: `env-${nanoid()}`, // TODO: This should be environment ID
    taskQueue: 'env-ctrl-wf',
  };

  const interval$ = interval(1000);
  interval$.pipe(take(1000)).subscribe(async n => {
    const workflow = await client.start(EnvrionmentControllerWorkflow, {
      workflowId: `env-${n}-${nanoid()}`,
      ...options,
    });
    await workflow.result();
  });
};

runWorkflow().catch(err => {
  console.error(`Workflow stopped: ${err}`);
  process.exit(1);
});
