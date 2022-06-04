import { sleep } from '@ctrlplane/common/utils/extras';
import { Semaphore } from '@ctrlplane/common/utils/rx-semaphore';
import * as factory from 'factory.ts';
import { nanoid } from 'nanoid';
import { from, map, mergeMap, Subject, take, tap } from 'rxjs';

interface Signal {
  id: string;
  sleep: number;
}

const semaphore = new Semaphore(5);
const signals$ = new Subject<Signal>();

signals$
  .pipe(
    tap(signal => console.log(`[${signal.id}] Waiting to acquire semaphore...`)),
    mergeMap(signal =>
      semaphore.acquire().pipe(
        tap(() => console.log(`[${signal.id}] Acquired semaphore ... Sleeping for ${signal.sleep}ms`)),
        mergeMap(() =>
          from(sleep(signal.sleep * 1000)).pipe(
            tap(() => console.log(`[${signal.id}] Waking up after ${signal.sleep} ... Releasing semaphore`)),
            tap(() => semaphore.release()),
            tap(() => console.log(`[${signal.id}] Released semaphore ...`)),
            map(() => signal),
          ),
        ),
        take(1),
      ),
    ),
  )
  .subscribe(result => {
    console.log(`[${result.id}] Result: ${result.sleep}`);
  });

const signalFactory = factory.Sync.makeFactory<Signal>({
  id: factory.each(() => nanoid()),
  sleep: factory.each(() => Math.floor(Math.random() * 50)),
});

let signals: Signal[] = signalFactory.buildList(15);

for (const signal of signals) {
  console.log(`[${signal.id}] [${signal.sleep}] Scheduling ...`);
  signals$.next(signal);
}

await sleep(5);

semaphore.resize(10);

signals = signalFactory.buildList(15);

for (const signal of signals) {
  console.log(`[${signal.id}] [${signal.sleep}] Scheduling ...`);
  signals$.next(signal);
}

await sleep(5);

semaphore.resize(3);

signals = signalFactory.buildList(15);

for (const signal of signals) {
  console.log(`[${signal.id}] [${signal.sleep}] Scheduling ...`);
  signals$.next(signal);
}
