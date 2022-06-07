import { TestEnvironment } from '@ctrlplane/common/models';
import { SIG_TERMINATE_RUN_TEST_WORKFLOW, SIG_UPDATE_ENV_CTRL_WORKFLOW } from '@ctrlplane/common/names';
import { defineSignal } from '@temporalio/workflow';

export const UpdateEnvCtrlWorkflow = defineSignal<[TestEnvironment]>(SIG_UPDATE_ENV_CTRL_WORKFLOW);
export const TerminateRunTestWorkflow = defineSignal<[]>(SIG_TERMINATE_RUN_TEST_WORKFLOW);
