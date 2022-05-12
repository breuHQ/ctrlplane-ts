import { Sinks } from '@temporalio/workflow';
import { InjectedSinks } from '@temporalio/worker';
import * as wf from '@temporalio/workflow';

interface LoggerSinks extends Sinks {
  logger: {
    info(message: string): void;
  };
}

export const sinks: InjectedSinks<LoggerSinks> = {
  logger: {
    info: {
      fn(workflowInfo, message) {
        console.info(`Workflow [${workflowInfo.runId}]: ${message}`);
      },
    },
  },
};

const WorkflowLogger = wf.proxySinks<LoggerSinks>();
export const workflowLogger = WorkflowLogger.logger;
