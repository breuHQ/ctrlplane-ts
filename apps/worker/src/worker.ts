import { ActivityInboundLogInterceptor } from '@ctrlplane/common/activities';
import { createWorkflowLoggerSink, formatLogMessage } from '@ctrlplane/common/logging';
import { LoggerSinks, TestExecutionResultStatus } from '@ctrlplane/common/models';
import { QUEUE_ENV_CTRL } from '@ctrlplane/common/names';
import * as activities from '@ctrlplane/workflows/activities';
import { BatchV1Api, KubeConfig, makeInformer, V1Job } from '@kubernetes/client-node';
import { AsyncCompletionClient } from '@temporalio/client';
import { DefaultLogger, InjectedSinks, LogLevel, Runtime, Worker } from '@temporalio/worker';
import path from 'path';
import { fromEvent, tap } from 'rxjs';
import { createLogger } from './logger';

const logLevel: LogLevel = 'INFO';

const logger = createLogger(logLevel);

const worker = async () => {
  const workerLogger = logger.child({ label: 'Worker' });
  const workflowLogger = logger.child({ label: 'Workflow' });
  const activityLogger = logger.child({ label: 'Activity' });

  Runtime.install({
    logger: new DefaultLogger(logLevel, entry => {
      workerLogger.log({
        level: entry.level.toLocaleLowerCase(), // NOTE: ysf: this is a hack to get the level to work
        message: entry.message,
        timestamp: Number(entry.timestampNanos / 1_000_000_000n),
        ...entry.meta,
      });
    }),
  });

  const sinks: InjectedSinks<LoggerSinks> = createWorkflowLoggerSink(workflowLogger, formatLogMessage);

  const workflowsPath = new URL(`./workflows${path.extname(import.meta.url)}`, import.meta.url).pathname;
  const wrkr = await Worker.create({
    activities,
    workflowsPath,
    taskQueue: QUEUE_ENV_CTRL,
    sinks,
    interceptors: {
      activityInbound: [ctx => new ActivityInboundLogInterceptor(ctx, activityLogger)],
    },
  });

  await wrkr.run();
};

worker()
  .then(async () => {
    const client = new AsyncCompletionClient(); // TODO: for production, update to pick connection settings from environment
    const k8sConfig = new KubeConfig();
    k8sConfig.loadFromDefault();

    const k8sBatch = k8sConfig.makeApiClient(BatchV1Api);
    const listFn = () => k8sBatch.listNamespacedJob('ctrlplane');

    const informer = makeInformer(k8sConfig, '/apis/batch/v1/namespaces/ctrlplane/jobs', listFn);

    fromEvent(informer, 'add')
      .pipe(tap(job => heartbeatActivity(job, client)))
      .subscribe();

    fromEvent(informer, 'change')
      .pipe(tap(async job => succeededOrHeartbeatActivity(job, client)))
      .subscribe();

    fromEvent(informer, 'error')
      .pipe(tap(async job => failedTestPlanActivity(job, client)))
      .subscribe();

    fromEvent(informer, 'delete')
      .pipe(tap(async job => terminatedTestPlan(job, client)))
      .subscribe();
  })
  .catch(err => {
    console.error(`Worker stopped: ${err}`);
    process.exit(1);
  });

const parseTestPlanLabels = (job: V1Job) => {
  const labels = job.metadata?.labels || {};
  const activityId = labels['ctrlplane.dev/activity-id'];
  const planId = labels['ctrlplane.dev/plan-id'];
  const workflowId = labels['ctrlplane.dev/workflow-id'];
  return { activityId, planId, workflowId };
};

const succeededOrHeartbeatActivity = async (job: V1Job, client: AsyncCompletionClient) => {
  const { activityId, planId, workflowId } = parseTestPlanLabels(job);
  job.status?.succeeded
    ? await client.complete({ workflowId, activityId }, { id: planId, status: TestExecutionResultStatus.SUCCESS })
    : await client.heartbeat({ workflowId, activityId });
};

const failedTestPlanActivity = async (job: V1Job, client: AsyncCompletionClient) => {
  const { activityId, planId, workflowId } = parseTestPlanLabels(job);
  await client.complete({ workflowId, activityId }, { id: planId, status: TestExecutionResultStatus.FAILURE });
};

const terminatedTestPlan = async (job: V1Job, client: AsyncCompletionClient) => {
  const { activityId, planId, workflowId } = parseTestPlanLabels(job);
  await client.complete({ workflowId, activityId }, { id: planId, status: TestExecutionResultStatus.TERMINATED });
};

const heartbeatActivity = async (job: V1Job, client: AsyncCompletionClient) => {
  const { activityId, workflowId } = parseTestPlanLabels(job);
  await client.heartbeat({ workflowId, activityId });
};
