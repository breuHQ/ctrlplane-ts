import { getContext } from '@ctrlplane/common/activities';
import { TestPlan } from '@ctrlplane/common/models';
import { BatchV1Api, KubeConfig, V1Job, V1JobSpec, V1ObjectMeta, makeInformer } from '@kubernetes/client-node';

const createJobSpec = (runId: string, plan: TestPlan) => {
  const name = plan.id;
  const image = 'busybox:latest';
  const restartPolicy = 'Never';
  const command = ['/bin/sh', '-c', `sleep ${plan.sleepSeconds} && echo "Finished" && exit 0`];
  const metadata = new V1ObjectMeta();
  metadata.name = name;
  metadata.labels = {
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

export const terminateTest: (plan: TestPlan) => Promise<void> = async plan => {
  return;
};

export const runTest: (plan: TestPlan) => Promise<void> = async plan => {
  return new Promise((resolve, reject) => {
    const ctx = getContext();
    const spec = createJobSpec(ctx.info.workflowExecution.runId, plan);
    const labelSelector = `ctrlplane.dev/plan-id=${plan.id}`;
    ctx.logger.info(`[${ctx.info.workflowType}] [${ctx.info.workflowExecution.workflowId}] [${plan.sleepSeconds}s]`);

    const k8sConfig = new KubeConfig();
    k8sConfig.loadFromDefault();

    const k8sBatch = k8sConfig.makeApiClient(BatchV1Api);

    const listFn = () =>
      k8sBatch.listNamespacedJob('default', undefined, undefined, undefined, undefined, labelSelector);

    const informer = makeInformer(k8sConfig, '/apis/batch/v1/namespaces/default/jobs', listFn, labelSelector);

    informer.on('add', () => {
      ctx.logger.info(
        `[${ctx.info.workflowType}] [${ctx.info.workflowExecution.workflowId}] [${plan.sleepSeconds}s] Starting ... `,
      );
    });

    informer.on('change', event => {
      ctx.logger.info(
        `[${ctx.info.workflowType}] [${ctx.info.workflowExecution.workflowId}] [${plan.sleepSeconds}s] Heartbeat ...`,
      );
      if (event.status?.succeeded) {
        informer.stop().then(() => {
          ctx.logger.info(
            `[${ctx.info.workflowType}] [${ctx.info.workflowExecution.workflowId}] [${plan.sleepSeconds}s] Finished`,
          );
          resolve();
        });
      }
    });

    informer.start().then(() => {
      k8sBatch.createNamespacedJob('default', spec).catch(err => {
        reject(err.response.body.message);
      });
    });
  });
};
