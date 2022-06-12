import { LogLevel } from '@temporalio/core-bridge';
import { InjectedSinks } from '@temporalio/worker';
import { WorkflowInfo } from '@temporalio/workflow';
import { LEVEL, MESSAGE, SPLAT } from 'triple-beam';
import winston, { Logger } from 'winston';
import { LoggerSinks } from './models';

type WorkflowLogFormatterFn = (info: WorkflowInfo, message: string) => string;

export const workflowLogFormatter: WorkflowLogFormatterFn = (info: WorkflowInfo, message: string) =>
  `[${info.workflowType}] [${info.workflowId}] ${message}`;

export const createWorkflowLoggerSink = (
  logger: Logger,
  formatLogMessage: WorkflowLogFormatterFn,
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

const timestampToISO = (timestamp: number): string => (timestamp ? new Date(timestamp).toJSON() : new Date().toJSON());

const fmt = winston.format.printf(({ level, message, label, timestamp, ...rest }) => {
  // The type signature in winston is wrong
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { [LEVEL]: _lvl, [SPLAT]: _splt, [MESSAGE]: _msg, ...restNoSymbols } = rest as Record<string | symbol, unknown>;
  return `${timestampToISO(timestamp)} [${level}] [${label}]: ${message}`;

  // return Object.keys(restNoSymbols).length === 0
  //   ? `${timestampToISO(timestamp)} [${level}] [${label}]: ${message}`
  //   : `${timestampToISO(timestamp)} [${level}] [${label}]: ${message} ${util.inspect(restNoSymbols, false, 4, true)}`;
});

export const createLogger = (logLevel: LogLevel): winston.Logger =>
  winston.createLogger({
    level: logLevel.toLocaleLowerCase(),
    format: winston.format.combine(fmt),
    transports: [new winston.transports.Console()],
  });
