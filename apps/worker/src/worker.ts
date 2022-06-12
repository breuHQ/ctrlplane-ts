import { ActivityInboundLogInterceptor } from '@ctrlplane/common/activities';
import { createWorkflowLoggerSink, workflowLogFormatter, createLogger } from '@ctrlplane/common/logging';
import { LoggerSinks } from '@ctrlplane/common/models';
import { QUEUE_ENV_CTRL } from '@ctrlplane/common/names';
import * as activities from '@ctrlplane/workflows/activities';
import { DefaultLogger, InjectedSinks, LogLevel, Runtime, Worker } from '@temporalio/worker';
import path from 'path';

const logLevel: LogLevel = 'INFO';

const logger = createLogger(logLevel);

const main = async () => {
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

  const sinks: InjectedSinks<LoggerSinks> = createWorkflowLoggerSink(workflowLogger, workflowLogFormatter);

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
