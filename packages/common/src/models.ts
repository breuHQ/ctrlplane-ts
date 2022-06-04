import { Sinks } from '@temporalio/workflow';

export interface LoggerSinks extends Sinks {
  logger: {
    debug(message: string, meta?: unknown): void;
    info(message: string, meta?: unknown): void;
    error(message: string, meta?: unknown): void;
    warn(message: string, meta?: unknown): void;
  };
}

export interface TestPlan {
  id: string;
  sleepSeconds: number;
}

export interface TestEnvironment {
  id: string;
  continue: boolean;
  maxParallism: number;
  tests: Array<TestPlan>;
}

export const enum ExecutionResultStatusType {
  SUCCESS,
  FAILURE,
  SKIPPED,
  TERMINATED,
}

type ExectionResultStatus = keyof typeof ExecutionResultStatusType;

export interface ExecutionResult {
  id: string;
  status: ExectionResultStatus;
}
