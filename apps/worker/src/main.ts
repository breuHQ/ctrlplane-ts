import { Worker } from '@temporalio/worker';
import { activities } from '@ctrlplane.dev/env-ctrl-workflow';

/**
 * @type {Worker}
 */
const main = async () => {
  const worker = await Worker.create({
    activities,
    workflowBundle: { path: require.resolve('./../env-ctrl-workflow/workflow.js') },
    taskQueue: 'env-ctrl-wf',
  });

  await worker.run();
};

main().catch(err => {
  console.error(`Worker stopped: ${err}`);
  process.exit(1);
});
