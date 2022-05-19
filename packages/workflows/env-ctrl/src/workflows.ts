import { TestEnvironment } from '@ctrlplane/common/models';
import {
  logger,
  WorkflowInboundLogInterceptor,
  UpdateEnvironmentControllerlWorkflowSignal,
} from '@ctrlplane/common/workflows';
import { proxyActivities, WorkflowInterceptorsFactory, setHandler } from '@temporalio/workflow';
import type * as activities from './activities';
import { Semaphore } from './semaphore';

const activity = proxyActivities<typeof activities>({
  startToCloseTimeout: '60 minutes',
});

export const EnvrionmentControllerWorkflow = async (env: TestEnvironment) => {
  let size: number;
  size = env.maxParallism;
  const results: Array<Promise<void>> = [];
  const semaphore = new Semaphore(env.maxParallism);
  logger.info(`Starting ... `);
  logger.info(`Test: ${env.tests.length}`);
  logger.info(`Max Parallelism: ${env.maxParallism}`);

  for (const plan of env.tests) {
    logger.info(`[act-${plan.id}] Scheduling [${plan.sleepSeconds}s]`);
    results.push(semaphore.fire(() => activity.createEnvironment(plan, env.maxParallism)));
  }

  setHandler(UpdateEnvironmentControllerlWorkflowSignal, async signal => {
    logger.info(`Signaling update ...`);
    logger.info(`Tests: ${signal.tests.length}`);
    logger.info(`Max Parralism [New || Old]: ${signal.maxParallism} || ${size}`);
    logger.info(`Resizing Semaphore to ${signal.maxParallism}`);
    size = signal.maxParallism;
    semaphore.resize(signal.maxParallism);

    for (const plan of signal.tests) {
      logger.info(`[act-${plan.id}] Scheduling [${plan.sleepSeconds}s]`);
      results.push(semaphore.fire(() => activity.createEnvironment(plan, signal.maxParallism)));
    }
  });

  await semaphore.awaitTerminate();
  return;
};

export const interceptors: WorkflowInterceptorsFactory = () => ({
  inbound: [new WorkflowInboundLogInterceptor()],
});
