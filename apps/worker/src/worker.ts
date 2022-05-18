import { ActivityInboundLogInterceptor } from '@ctrlplane/common/activities';
import { LoggerSinks } from '@ctrlplane/common/models';
import { activities } from '@ctrlplane/workflows/env-ctrl';
import { DefaultLogger, InjectedSinks, Runtime, Worker } from '@temporalio/worker';
import { WorkflowInfo } from '@temporalio/workflow';
import path from 'path';
import { createLogger } from './logger';

const logger = createLogger();

const main = async () => {
  const workerLogger = logger.child({ label: 'Worker' });
  const workflowLogger = logger.child({ label: 'Workflow' });
  const activityLogger = logger.child({ label: 'Activity' });

  Runtime.install({
    logger: new DefaultLogger('INFO', entry => {
      workerLogger.log({
        // level: entry.level.toLocaleLowerCase(),
        level: entry.level,
        message: entry.message,
        timestamp: Number(entry.timestampNanos / 1_000_000_000n),
        ...entry.meta,
      });
    }),
  });

  const formatMessage = (info: WorkflowInfo, message: string) =>
    `[${info.workflowType}] [${info.workflowId}]: ${message}`;

  const sinks: InjectedSinks<LoggerSinks> = {
    logger: {
      debug: {
        fn(workflowInfo, message, meta) {
          workflowLogger.child(workflowInfo).debug(formatMessage(workflowInfo, message), meta);
        },
      },
      info: {
        fn(workflowInfo, message, meta) {
          workflowLogger.child(workflowInfo).info(formatMessage(workflowInfo, message), meta);
        },
      },
      error: {
        fn(workflowInfo, message, meta) {
          workflowLogger.child(workflowInfo).error(formatMessage(workflowInfo, message), meta);
        },
      },
      warn: {
        fn(workflowInfo, message, meta) {
          workflowLogger.child(workflowInfo).warn(formatMessage(workflowInfo, message), meta);
        },
      },
    },
  };

  const workflowsPath = new URL(`./workflows${path.extname(import.meta.url)}`, import.meta.url).pathname;
  workerLogger.info(`Workflows path: ${workflowsPath}`);
  const worker = await Worker.create({
    activities,
    workflowsPath,
    taskQueue: 'env-ctrl-wf',
    sinks,
    interceptors: {
      activityInbound: [ctx => new ActivityInboundLogInterceptor(ctx, activityLogger)],
    },
  });

  await worker.run();
};

main().catch(err => {
  console.error(`Worker stopped: ${err}`);
  process.exit(1);
});
