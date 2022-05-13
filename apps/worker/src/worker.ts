import { Worker } from '@temporalio/worker';
import { activities, sinks } from '@ctrlplane/workflows/env-ctrl';
import path from 'path';

const main = async () => {
  // const workflowsPath = new URL('./workflows-bundle.js').pathname;
  const workflowsPath = new URL(`./workflows${path.extname(import.meta.url)}`, import.meta.url).pathname;
  console.info(`Workflows path: ${workflowsPath}`);
  const worker = await Worker.create({
    activities,
    workflowsPath,
    // workflowBundle: { path: require.resolve('./workflows-bundle.js') },
    taskQueue: 'env-ctrl-wf',
    sinks,
  });

  await worker.run();
};

main().catch(err => {
  console.error(`Worker stopped: ${err}`);
  process.exit(1);
});
