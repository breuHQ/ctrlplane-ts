import { getContext } from '@ctrlplane/common/activities';
import { TestPlan, TestExecutionResult, TestExecutionResultStatus, TestEnvironment } from '@ctrlplane/common/models';
import { BatchV1Api, KubeConfig, V1Job, V1JobSpec, V1ObjectMeta, makeInformer } from '@kubernetes/client-node';

/**
 * Create a Kubernetes Job for a given test plan
 *
 * @param {TestPlan} plan The plan to create the job for.
 * @returns {Promise<TestExecutionResult>} The test execution result.
 */
export const RunTest = async (plan: TestPlan): Promise<TestExecutionResult> => {
  return new Promise((resolve, _) => {
    const ctx = getContext();
    const spec = _createJobSpec(ctx.info.workflowExecution.runId, plan);
    const labelSelector = `ctrlplane.dev/plan-id=${plan.id}`;

    const k8sConfig = new KubeConfig();
    k8sConfig.loadFromDefault();

    const k8sBatch = k8sConfig.makeApiClient(BatchV1Api);

    const listFn = () =>
      k8sBatch.listNamespacedJob('default', undefined, undefined, undefined, undefined, labelSelector);

    const informer = makeInformer(k8sConfig, '/apis/batch/v1/namespaces/default/jobs', listFn, labelSelector);

    informer.on('change', event => {
      ctx.heartbeat();
      if (event.status?.succeeded) {
        informer.stop().then(() => resolve({ id: plan.id, status: TestExecutionResultStatus.SUCCESS }));
      }
    });

    informer.on('delete', () => resolve({ id: plan.id, status: TestExecutionResultStatus.TERMINATED }));

    informer.start().then(() => {
      k8sBatch.createNamespacedJob('default', spec).catch(err =>
        resolve({
          id: plan.id,
          status: TestExecutionResultStatus.FAILURE,
          message: err.response.body.message,
        }),
      );
    });
  });
};

/**
 *
 * @param {TestEnvironment} environment The environment to terminate
 * @returns {Promise<void>}
 */
export const TerminateEnvironmentTests = async (environment: TestEnvironment): Promise<void> => {
  const k8sConfig = new KubeConfig();
  k8sConfig.loadFromDefault();
  const k8sBatch = k8sConfig.makeApiClient(BatchV1Api);
  await k8sBatch.deleteCollectionNamespacedJob(
    'default',
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    `ctrlplane.dev/environment-id=${environment.id}`,
  );
  return;
};

/**
 * Create the job spec for the given test plan
 *
 * @param {string} runId The run ID of the workflow
 * @param {TestPlan} plan The test plan to create the job for.
 * @returns {V1Job}
 */
const _createJobSpec = (runId: string, plan: TestPlan): V1Job => {
  const name = plan.id;
  const image = 'busybox:latest';
  const restartPolicy = 'Never';
  const command = ['/bin/sh', '-c', `sleep ${plan.sleepSeconds} && echo "Finished" && exit 0`];
  const metadata = new V1ObjectMeta();
  metadata.name = name;
  metadata.labels = {
    'ctrlplane.dev/environment-id': plan.environmentId,
    'ctrlplane.dev/plan-id': plan.id,
    'ctrlplane.dev/run-id': runId,
  };
  const job = new V1Job();
  job.metadata = metadata;
  job.apiVersion = 'batch/v1';
  job.kind = 'Job';
  const spec = {
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
  } as V1JobSpec;
  job.spec = spec;
  return job;
};
