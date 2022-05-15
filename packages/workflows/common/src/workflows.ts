import { Next, proxySinks, WorkflowExecuteInput, WorkflowInboundCallsInterceptor } from '@temporalio/workflow';
import { LoggerSinks } from './models';

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
