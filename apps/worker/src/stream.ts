import { sleep } from '@ctrlplane/common/utils/extras';
import { BehaviorSubject, filter, from, map, mergeMap, Observable, Subject, take, tap } from 'rxjs';
import * as factory from 'factory.ts';
import { nanoid } from 'nanoid';

interface Signal {
  id: string;
  sleep: number;
}

export class Semaphore {
  private counter: number;
  private counter$: BehaviorSubject<number>;
  private available$: Observable<number>;

  constructor(count: number) {
    this.counter = count;
    this.counter$ = new BehaviorSubject(this.counter);

    this.available$ = this.counter$.pipe(filter(() => this.counter > 0));
  }

  acquire(): Observable<Semaphore> {
    return this.available$.pipe(
      take(1),
      tap(() => {
        this.counter--;
        this.counter$.next(this.counter);
      }),
      map(() => this),
    );
  }

  release() {
    this.counter++;
    this.counter$.next(this.counter);
  }
}

const semaphore$ = new Semaphore(5);
const signals$ = new Subject<Signal>();

signals$
  .pipe(
    tap(signal => console.log(`[${signal.id}] Waiting to acquire semaphore...`)),
    mergeMap(signal =>
      semaphore$.acquire().pipe(
        tap(() => console.log(`[${signal.id}] Acquired semaphore ... Sleeping for ${signal.sleep}ms`)),
        mergeMap(() =>
          from(sleep(signal.sleep * 1000)).pipe(
            tap(() => console.log(`[${signal.id}] Waking up after ${signal.sleep} ... Releasing semaphore`)),
            tap(() => semaphore$.release()),
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

const signals: Signal[] = signalFactory.buildList(50);

for (const signal of signals) {
  console.log(`[${signal.id}] [${signal.sleep}] Scheduling ...`);
  signals$.next(signal);
}
