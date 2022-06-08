import { Connection, WorkflowClient } from '@temporalio/client';
import { Worker } from '@temporalio/worker';
import * as activities from '../activities';
import path from 'path';

describe('Environment Control Workflow', () => {
  let shutdown: unknown;
  let worker: Worker;
  let client: WorkflowClient;

  beforeAll(async () => {
    const workflowsPath = new URL(`../workflows${path.extname(import.meta.url)}`, import.meta.url).pathname;
    worker = await Worker.create({
      activities,
      // workflowsPath: require.resolve('../workflows.ts'),
      workflowsPath,
      taskQueue: 'workflow-tests',
    });

    const connection = new Connection();
    client = new WorkflowClient(connection.service);

    shutdown = worker.run();
  });

  test('Worker is running', () => {
    expect(worker).toBeDefined();
  });

  test('Client is running', () => {
    expect(client).toBeDefined();
  });

  afterAll(async () => {
    worker.shutdown();
    await shutdown;
  });
});
