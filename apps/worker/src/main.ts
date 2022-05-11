import { Worker } from '@temporalio/worker';
import { activities } from '@ctrlplane.dev/env-ctrl-workflow';

const main = async () => {
  const worker = await Worker.create({
    activities,
    workflowBundle: { path: require.resolve('./../../../../packages/workflows/env-ctrl/build/src/workflow.js') },
    taskQueue: 'env-ctrl-wf',
  });

  await worker.run();
};

main().catch(err => {
  console.error(`Worker stopped: ${err}`);
  process.exit(1);
});
