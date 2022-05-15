import { LEVEL, MESSAGE, SPLAT } from 'triple-beam';
import util from 'util';
import winston from 'winston';

/** Turns a given timestamp or current Date to an ISO date string */
function getDateStr(timestamp?: number): string {
  return timestamp ? new Date(timestamp).toJSON() : new Date().toJSON();
}

/** Format function for logging in development */
const formatLog = winston.format.printf(({ level, message, label, timestamp, ...rest }) => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires

  // The type signature in winston is wrong
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { [LEVEL]: _lvl, [SPLAT]: _splt, [MESSAGE]: _msg, ...restNoSymbols } = rest as Record<string | symbol, unknown>;
  // return `${getDateStr(timestamp)} [${label}] ${level}: ${message}`;

  return Object.keys(restNoSymbols).length === 0
    ? `${getDateStr(timestamp)} [${label}] ${level}: ${message}`
    : `${getDateStr(timestamp)} [${label}] ${level}: ${message} ${util.inspect(restNoSymbols, false, 4, true)}`;
});

/** Create a winston logger from given options */
export function createLogger(): winston.Logger {
  return winston.createLogger({
    level: 'debug',
    format: winston.format.combine(formatLog),
    transports: [new winston.transports.Console()],
  });
}
