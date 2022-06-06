import { TestEnvironment, TestPlan } from '@ctrlplane/common/models';
import * as factory from 'factory.ts';
import { customAlphabet } from 'nanoid';
import { randomInt } from 'crypto';

const alphabet = 'abcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet(alphabet, 21);

/**
 * # Given the count, generate a list of test environments.
 *
 * ## What is a test environment?
 *
 * A test environment, identified by a unique ID, is an execution environment used to control the maximum number of
 * parallel tests that can be run. The said test environment is unique to a customer. A customer can schedule tests in
 * the same environment multiple times.
 *
 * In order to control parallel scheduling, [temporal's workflow id](https://temporal.io/workflow) is mapped against an
 * environment ID.
 *
 * ## Generating environments
 *
 * We first generate unique environments. In order for us to test parallel scheduling, we keep the number of generated
 * environment IDs as half of the given count. To schedule a new test suite, we first check if the workflow defined by
 * environment ID is running. If yes, we push the new suite.
 *
 * The workflow itself controls the maximum number of parallel test runs by making use of semaphore. \
 *
 *
 * @export
 * @param {number} max The number of environments to generate
 * @returns {TestEnvironment[]} The generated environments
 */
export const createTestEnvironments = (max: number): TestEnvironment[] => {
  // const generateIdPool = (count: number) => {
  //   const ids = [];
  //   for (let i = 0; i < count / 2; i++) {
  //     ids.push(nanoid());
  //   }
  //   return ids;
  // };

  // const pool = generateIdPool(count);

  const pool = [
    'BhCoT7m0xL3SnI1iKrNUW',
    'EreT7CaPN0mVdIll1oXaF',
    'g7OKuKSRMez2Gk30c0lzz',
    'gFeJ-D7pMymFIhQdZMjP5',
    'Jyp4k5nH13MsPzTtmpyzi',
    'L5yyyTBrWQCC99KleRt7j',
  ];

  const fromPool = () => pool[randomInt(0, pool.length - 1)];

  const testPlanFactory = factory.Sync.makeFactory<TestPlan>({
    id: factory.each(() => nanoid()),
    sleepSeconds: factory.each(() => {
      const count = Math.floor(Math.random() * max);
      return count < 1 ? 1 : count;
    }),
  });

  const testEnvironmentFactory = factory.Sync.makeFactory<TestEnvironment>({
    id: factory.each(fromPool),
    maxParallism: factory.each(() => {
      const count = Math.floor(Math.random() * max);
      return count < 1 ? 1 : count;
    }),
    continue: factory.each(() => Math.random() > 0.5),
    // continue: true,
    // tests: factory.each(() => testPlanFactory.buildList(Math.floor(Math.random() * max))),
    tests: factory.each(() => testPlanFactory.buildList(max)),
  });

  return testEnvironmentFactory.buildList(max);
};
