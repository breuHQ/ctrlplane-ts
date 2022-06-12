import { TestExecutionResultStatus } from '@ctrlplane/common/models';
import { createLogger } from '@ctrlplane/common/logging';
import { V1Job, KubeConfig, BatchV1Api, makeInformer } from '@kubernetes/client-node';
import { AsyncCompletionClient, ActivityNotFoundError } from '@temporalio/client';
import { fromEvent, tap } from 'rxjs';

interface PlanInfo {
  activityId: string;
  environmentId: string;
  planId: string;
}

const logLevel = 'INFO'; // TODO: pick this from environment variable

const _logger = createLogger(logLevel);
const logger = _logger.child({ label: 'Proctor' });

const main = async () => {
  const client = new AsyncCompletionClient(); // TODO: for production, update to pick connection settings from environment
  const k8sConfig = new KubeConfig();
  k8sConfig.loadFromDefault();

  const k8sBatch = k8sConfig.makeApiClient(BatchV1Api);
  const listFn = () => k8sBatch.listNamespacedJob('ctrlplane');

  const informer = makeInformer(k8sConfig, '/apis/batch/v1/namespaces/ctrlplane/jobs', listFn);

  fromEvent(informer, 'add')
    .pipe(tap(job => heartbeatTestPlan(job, client)))
    .subscribe();

  fromEvent(informer, 'change')
    .pipe(tap(async job => successOrHeartbeatTestPlan(job, client)))
    .subscribe();

  fromEvent(informer, 'error')
    .pipe(tap(async job => failTestPlan(job, client)))
    .subscribe();

  fromEvent(informer, 'delete')
    .pipe(tap(async job => terminateTestPlan(job, client)))
    .subscribe();

  informer.start().catch(() => {
    console.log('Failed to start informer');
  });
};

main().catch(err => console.error(err));

/**
 * Given a job, parse the labels and return the activityId, environmentId, and planId
 *
 * @param {V1Job} job The job to parse
 * @return {PlanInfo}
 */
function getInfoFromLabels(job: V1Job): PlanInfo {
  const labels = job.metadata?.labels || {};
  const activityId = labels['ctrlplane.dev/activity-id'];
  const planId = labels['ctrlplane.dev/plan-id'];
  const environmentId = labels['ctrlplane.dev/environment-id'];
  return { activityId, planId, environmentId };
}

/**
 * If the job is in a success state, we can assume that the test plan has completed successfully.
 *
 * @param {V1Job} job The test plan job spec to check
 * @param {AsyncCompletionClient} client Temporal's async completion client
 * @return {*}  {Promise<void>}
 */
async function successOrHeartbeatTestPlan(job: V1Job, client: AsyncCompletionClient): Promise<void> {
  const { activityId, planId, environmentId } = getInfoFromLabels(job);
  const workflowId = `${planId}`;
  try {
    job.status?.succeeded && activityId && environmentId && planId
      ? await client.complete({ workflowId, activityId }, { id: planId, status: TestExecutionResultStatus.SUCCESS })
      : await client.heartbeat({ workflowId, activityId });
  } catch (e) {
    if (e instanceof ActivityNotFoundError) {
      logger.warn(`[${environmentId}] [${planId}] [${activityId}] [¡] Not Found. Already Processed.`);
    } else {
      console.error(e);
    }
  }
}

async function failTestPlan(job: V1Job, client: AsyncCompletionClient): Promise<void> {
  const { activityId, planId, environmentId } = getInfoFromLabels(job);
  const workflowId = `${planId}`;
  try {
    await client.complete({ workflowId, activityId }, { id: planId, status: TestExecutionResultStatus.FAILURE });
  } catch (error) {
    if (error instanceof ActivityNotFoundError) {
      logger.warn(`[${environmentId}] [${planId}] [${activityId}] [✘] Not Found. Already Processed.`);
    }
  }
}

async function terminateTestPlan(job: V1Job, client: AsyncCompletionClient): Promise<void> {
  const { activityId, planId, environmentId } = getInfoFromLabels(job);
  const workflowId = `${planId}`;
  try {
    await client.complete({ workflowId, activityId }, { id: planId, status: TestExecutionResultStatus.TERMINATED });
  } catch (error) {
    if (error instanceof ActivityNotFoundError) {
      logger.warn(`[${environmentId}] [${planId}] [${activityId}] [✘] Not Found. Already Processed.`);
    } else {
      logger.warn(error);
    }
  }
}

async function heartbeatTestPlan(job: V1Job, client: AsyncCompletionClient): Promise<void> {
  const { activityId, environmentId, planId } = getInfoFromLabels(job);
  const workflowId = `${planId}`;

  try {
    await client.heartbeat({ workflowId, activityId });
  } catch (error) {
    if (error instanceof ActivityNotFoundError) {
      logger.warn(`[${environmentId}] [${planId}] [${activityId}] [♥] Not Found. Already Processed.`);
    } else {
      logger.warn(error);
    }
  }
}
