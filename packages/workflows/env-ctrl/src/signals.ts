import { TestEnvironment } from '@ctrlplane/common/models';
import { SIGNAL_UPDATE_ENVIRONMENT_CTRL_WORKFLOW } from '@ctrlplane/common/names';
import { defineSignal } from '@temporalio/workflow';

export const UpdateEnvironmentControllerlWorkflowSignal = defineSignal<[TestEnvironment]>(
  SIGNAL_UPDATE_ENVIRONMENT_CTRL_WORKFLOW,
);
