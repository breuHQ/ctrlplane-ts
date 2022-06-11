import { InjectedSinks } from '@temporalio/worker';
import { WorkflowInfo } from '@temporalio/workflow';
import { Logger } from 'winston';
import { FormatLogMessageFn, LoggerSinks } from './models';

export const formatLogMessage: FormatLogMessageFn = (info: WorkflowInfo, message: string) =>
  `[${info.workflowType}] [${info.workflowId}] ${message}`;

export const createWorkflowLoggerSink = (
  logger: Logger,
  formatLogMessage: FormatLogMessageFn,
): InjectedSinks<LoggerSinks> => ({
  logger: {
    debug: {
      fn(info, message, meta) {
        logger.child(info).debug(formatLogMessage(info, message), meta);
      },
    },
    info: {
      fn(info, message, meta) {
        logger.child(info).info(formatLogMessage(info, message), meta);
      },
    },
    error: {
      fn(info, message, meta) {
        logger.child(info).error(formatLogMessage(info, message), meta);
      },
    },
    warn: {
      fn(info, message, meta) {
        logger.child(info).warn(formatLogMessage(info, message), meta);
      },
    },
  },
});
