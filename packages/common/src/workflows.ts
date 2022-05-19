import {
  Next,
  proxySinks,
  WorkflowExecuteInput,
  WorkflowInboundCallsInterceptor,
  defineSignal,
} from '@temporalio/workflow';
import { LoggerSinks, TestEnvironment } from './models';
import { SIGNAL_UPDATE_ENVIRONMENT_CTRL_WORKFLOW } from './names';

export const { logger } = proxySinks<LoggerSinks>();

/** Logs Workflow executions and their duration */
export class WorkflowInboundLogInterceptor implements WorkflowInboundCallsInterceptor {
  async execute(input: WorkflowExecuteInput, next: Next<WorkflowInboundCallsInterceptor, 'execute'>): Promise<unknown> {
    let error: unknown = undefined;
    const startTime = Date.now();
    try {
      return await next(input);
    } catch (err: unknown) {
      error = err;
      throw err;
    } finally {
      const durationMs = Date.now() - startTime;
      if (error) {
        logger.error('workflow failed', { error, durationMs });
      } else {
        logger.debug('workflow completed', { durationMs });
      }
    }
  }
}

export const UpdateEnvironmentControllerlWorkflowSignal = defineSignal<[TestEnvironment]>(
  SIGNAL_UPDATE_ENVIRONMENT_CTRL_WORKFLOW,
);
