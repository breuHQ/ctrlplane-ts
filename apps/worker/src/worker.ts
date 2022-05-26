import { ActivityInboundLogInterceptor } from '@ctrlplane/common/activities';
import { LoggerSinks } from '@ctrlplane/common/models';
import { QUEUE_ENV_CTRL } from '@ctrlplane/common/names';
import { activities } from '@ctrlplane/workflows/env-ctrl';
import { DefaultLogger, InjectedSinks, Runtime, Worker, LogLevel } from '@temporalio/worker';
import { WorkflowInfo } from '@temporalio/workflow';
import path from 'path';
import { createLogger } from './logger';

const logLevel: LogLevel = 'INFO';

const logger = createLogger(logLevel);

const main = async () => {
  const workerLogger = logger.child({ label: 'Worker' });
  const workflowLogger = logger.child({ label: 'Workflow' });
  const activityLogger = logger.child({ label: 'Activity' });

  Runtime.install({
    logger: new DefaultLogger(logLevel, entry => {
      workerLogger.log({
        level: entry.level.toLocaleLowerCase(),
        // level: entry.level,
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
        fn(level, message, meta) {
          workflowLogger.child(level).debug(formatMessage(level, message), meta);
        },
      },
      info: {
        fn(level, message, meta) {
          workflowLogger.child(level).info(formatMessage(level, message), meta);
        },
      },
      error: {
        fn(level, message, meta) {
          workflowLogger.child(level).error(formatMessage(level, message), meta);
        },
      },
      warn: {
        fn(level, message, meta) {
          workflowLogger.child(level).warn(formatMessage(level, message), meta);
        },
      },
    },
  };

  const workflowsPath = new URL(`./workflows${path.extname(import.meta.url)}`, import.meta.url).pathname;
  const worker = await Worker.create({
    activities,
    workflowsPath,
    taskQueue: QUEUE_ENV_CTRL,
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
