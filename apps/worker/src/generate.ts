import { TestEnvironment, TestPlan } from '@ctrlplane/common/models';
import * as factory from 'factory.ts';
import { nanoid } from 'nanoid';

const generateEnvironmetsIds = (count: number) => {
  const ids = [];
  for (let i = 0; i < count; i++) {
    ids.push(nanoid());
  }
  return ids;
};

export const testPlanFactory = factory.Sync.makeFactory<TestPlan>({
  id: factory.each(() => nanoid()),
  continue: factory.each(() => Math.random() > 0.5),
  sleepSeconds: factory.each(() => Math.floor(Math.random() * 10)),
});

export const testEnvironmentFactory = factory.Sync.makeFactory<TestEnvironment>({
  id: factory.each(() => nanoid()),
  maxParallism: factory.each(() => Math.floor(Math.random() * 10)),
  tests: factory.each(() => testPlanFactory.buildList(Math.floor(Math.random() * 100))),
});
