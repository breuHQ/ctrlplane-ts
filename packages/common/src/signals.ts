import { TestEnvironment } from './models';
import { SIGNAL_UPDATE_ENVIRONMENT_CTRL_WORKFLOW } from './names';
import { defineSignal } from '@temporalio/workflow';

export const UpdateEnvironmentControllerlWorkflowSignal = defineSignal<[TestEnvironment]>(
  SIGNAL_UPDATE_ENVIRONMENT_CTRL_WORKFLOW,
);
