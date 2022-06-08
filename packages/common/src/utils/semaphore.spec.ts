import { Semaphore } from './semaphore';
import { from, mergeMap, switchMap, tap } from 'rxjs';
import { sleep } from './extras';

describe('Semaphore', () => {
  let semaphore: Semaphore;

  beforeAll(() => {
    semaphore = new Semaphore(5);
  });

  test('is created', () => {
    expect(semaphore).toBeDefined();
  });

  test('has 5 maximum slots', () => {
    expect(semaphore.max).toBe(5);
  });

  test('has 5 available slots', () => {
    expect(semaphore.counter).toBe(5);
  });

  test('resizing the semaphore works', () => {
    semaphore.resize(6);
    expect(semaphore.max).toBe(6);
    expect(semaphore.counter).toBe(6);
  });

  test('it should acquire and hold the lock during execution and then release it', () => {
    const val = from([5000]);
    val
      .pipe(
        tap(() => expect(semaphore.max).toBe(6)),
        switchMap(val =>
          semaphore.acquire().pipe(
            tap(() => expect(semaphore.counter).toBe(5)),
            mergeMap(() => from(sleep(val))),
            tap(() => semaphore.release()),
            tap(() => expect(semaphore.counter).toBe(6)),
          ),
        ),
      )
      .subscribe();
  });
});
