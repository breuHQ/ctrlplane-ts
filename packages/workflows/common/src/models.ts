import { Sinks } from '@temporalio/workflow';

export interface LoggerSinks extends Sinks {
  logger: {
    debug(message: string, meta?: unknown): void;
    info(message: string, meta?: unknown): void;
    error(message: string, meta?: unknown): void;
    warn(message: string, meta?: unknown): void;
  };
}
