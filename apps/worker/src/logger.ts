import { LogLevel } from '@temporalio/core-bridge';
import { LEVEL, MESSAGE, SPLAT } from 'triple-beam';
import util from 'util';
import winston from 'winston';

export const formatLog = winston.format.printf(({ level, message, label, timestamp, ...rest }) => {
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
    format: winston.format.combine(formatLog),
    transports: [new winston.transports.Console()],
  });

export const timestampToISO = (timestamp: number): string =>
  timestamp ? new Date(timestamp).toJSON() : new Date().toJSON();
