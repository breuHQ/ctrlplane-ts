import { TestExecutionResultStatus } from '@ctrlplane/common/models';
import { V1Job, KubeConfig, BatchV1Api, makeInformer } from '@kubernetes/client-node';
import { AsyncCompletionClient, ActivityNotFoundError } from '@temporalio/client';
import { fromEvent, tap } from 'rxjs';

const parseTestPlanLabels = (job: V1Job) => {
  const labels = job.metadata?.labels || {};
  const activityId = labels['ctrlplane.dev/activity-id'];
  const planId = labels['ctrlplane.dev/plan-id'];
  const environmentId = labels['ctrlplane.dev/environment-id'];
  return { activityId, planId, environmentId };
};

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
 * If the job is in a success state, we can assume that the test plan has completed successfully.
 *
 * @param {V1Job} job The test plan job spec to check
 * @param {AsyncCompletionClient} client Temporal's async completion client
 * @return {*}  {Promise<void>}
 */
async function successOrHeartbeatTestPlan(job: V1Job, client: AsyncCompletionClient): Promise<void> {
  const { activityId, planId, environmentId } = parseTestPlanLabels(job);
  const workflowId = `${planId}`;
  try {
    job.status?.succeeded && activityId && environmentId && planId
      ? await client.complete({ workflowId, activityId }, { id: planId, status: TestExecutionResultStatus.SUCCESS })
      : await client.heartbeat({ workflowId, activityId });
  } catch (e) {
    if (e instanceof ActivityNotFoundError) {
      console.warn(
        `[WARN]: [${environmentId}] [${planId}] [✔] Activity [${activityId}] not found, assuming it was terminated`,
      );
    } else {
      console.error(e);
    }
  }
}

async function failTestPlan(job: V1Job, client: AsyncCompletionClient): Promise<void> {
  const { activityId, planId, environmentId } = parseTestPlanLabels(job);
  const workflowId = `${planId}`;
  try {
    await client.complete({ workflowId, activityId }, { id: planId, status: TestExecutionResultStatus.FAILURE });
  } catch (error) {
    if (error instanceof ActivityNotFoundError) {
      console.warn(
        `[WARN]: [${environmentId}] [${planId}] [✘] Activity [${activityId}] not found, assuming it was terminated`,
      );
    }
  }
}

async function terminateTestPlan(job: V1Job, client: AsyncCompletionClient): Promise<void> {
  const { activityId, planId, environmentId } = parseTestPlanLabels(job);
  const workflowId = `${planId}`;
  try {
    await client.complete({ workflowId, activityId }, { id: planId, status: TestExecutionResultStatus.TERMINATED });
  } catch (error) {
    if (error instanceof ActivityNotFoundError) {
      console.warn(
        `[WARN]: [${environmentId}] [${planId}] [✘] Activity [${activityId}] not found, assuming it was terminated`,
      );
    }
  }
}

async function heartbeatTestPlan(job: V1Job, client: AsyncCompletionClient): Promise<void> {
  const { activityId, environmentId, planId } = parseTestPlanLabels(job);
  const workflowId = `${planId}`;

  try {
    await client.heartbeat({ workflowId, activityId });
  } catch (e) {
    if (e instanceof ActivityNotFoundError) {
      console.warn(
        `[WARN]: [${environmentId}] [${planId}] [♥] Activity [${activityId}] not found, assuming it was terminated`,
      );
    } else {
      console.warn(e);
    }
  }
}
