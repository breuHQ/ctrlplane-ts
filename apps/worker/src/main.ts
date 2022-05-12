import { Worker } from '@temporalio/worker';
import { activities, sinks } from '@ctrlplane/workflows/env-ctrl';

const main = async () => {
  const worker = await Worker.create({
    activities,
    workflowBundle: { path: require.resolve('./workflows-bundle.js') },
    taskQueue: 'env-ctrl-wf',
    sinks,
  });

  await worker.run();
};

main().catch(err => {
  console.error(`Worker stopped: ${err}`);
  process.exit(1);
});
