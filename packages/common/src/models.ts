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

export const enum TestExecutionResultStatusType {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  SKIPPED = 'SKIPPED',
  TERMINATED = 'TERMINATED',
}

export type TestExectionResultStatus = keyof typeof TestExecutionResultStatusType;

export interface TestExecutionResult {
  id: string;
  status: TestExectionResultStatus;
  message?: string;
}
