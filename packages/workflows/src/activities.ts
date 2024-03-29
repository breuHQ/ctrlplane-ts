import { getContext } from '@ctrlplane/common/activities';
import { TestEnvironment, TestExecutionResult, TestPlan } from '@ctrlplane/common/models';
import { BatchV1Api, KubeConfig, V1Job, V1JobSpec, V1ObjectMeta } from '@kubernetes/client-node';
import { CompleteAsyncError } from '@temporalio/activity';

/**
 * Create a Kubernetes Job for a given test plan
 *
 * @param {TestPlan} plan The plan to create the job for.
 * @returns {Promise<TestExecutionResult>} The test execution result.
 */
export async function runTest(plan: TestPlan): Promise<TestExecutionResult> {
  const ctx = getContext();
  const spec = createJobSpec(plan, ctx.info.workflowExecution.runId, ctx.info.activityId);

  const k8sConfig = new KubeConfig();
  k8sConfig.loadFromDefault();

  const k8sBatch = k8sConfig.makeApiClient(BatchV1Api);

  await k8sBatch.createNamespacedJob('ctrlplane', spec);
  throw new CompleteAsyncError();
}

/**
 * terminates all the tests controlled by the environment
 *
 * @param {TestEnvironment} environment The environment to terminate
 * @returns {Promise<void>}
 */
export async function terminateEnvironmentTests(environment: TestEnvironment): Promise<void> {
  const k8sConfig = new KubeConfig();
  k8sConfig.loadFromDefault();
  const k8sBatch = k8sConfig.makeApiClient(BatchV1Api);
  await k8sBatch.deleteCollectionNamespacedJob(
    'ctrlplane',
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    `ctrlplane.dev/environment-id=${environment.id}`,
  );
  return;
}

/**
 * Create the job spec for the given test plan
 *
 * @param {string} runId The run ID of the workflow
 * @param {TestPlan} plan The test plan to create the job for.
 * @returns {V1Job}
 */
function createJobSpec(plan: TestPlan, runId: string, activityId: string): V1Job {
  const name = plan.id;
  const image = 'busybox:latest';
  const restartPolicy = 'Never';
  const command = ['/bin/sh', '-c', `sleep ${plan.sleepSeconds} && echo "Finished" && exit 0`];

  const metadata = new V1ObjectMeta();
  metadata.name = name;
  metadata.namespace = 'ctrlplane';
  metadata.labels = {
    'ctrlplane.dev/activity-id': activityId,
    'ctrlplane.dev/environment-id': plan.environmentId,
    'ctrlplane.dev/plan-id': plan.id,
    'ctrlplane.dev/run-id': runId,
  };

  const spec: V1JobSpec = {
    template: {
      spec: {
        restartPolicy,
        containers: [
          {
            name,
            image,
            command,
          },
        ],
      },
    },
  };

  const job = new V1Job();
  job.metadata = metadata;
  job.apiVersion = 'batch/v1';
  job.kind = 'Job';
  job.spec = spec;

  return job;
}
