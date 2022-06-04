import { BehaviorSubject, filter, map, Observable, take, tap } from 'rxjs';

/**
 * Given a number, creates a semaphore that can be used to limit the number of concurrent executions.
 *
 * @export
 * @class Semaphore
 */
export class Semaphore {
  /**
   * Reflects the number of available semaphore slots.
   *
   * @private
   * @type {number}
   * @memberof Semaphore
   */
  private _counter: number;

  /**
   * Available number of slots in the semaphore as an observable
   *
   * @private
   * @type {BehaviorSubject<number>}
   * @memberof Semaphore
   */
  private _counter$: BehaviorSubject<number>;

  /**
   * Restricts the number of slots to be greater than 0.
   *
   * @private
   * @type {Observable<number>}
   * @memberof Semaphore
   */
  private _available$: Observable<number>;

  /**
   * Creates an instance of Semaphore.
   * @param {number} max Maximum number of concurrent executions.
   * @memberof Semaphore
   */
  constructor(public max: number) {
    this._counter = max;
    this._counter$ = new BehaviorSubject(this._counter);
    this._available$ = this._counter$.pipe(filter(() => this._counter > 0));
  }

  /**
   * Acquires a slot on the semaphore.
   *
   * @return {*}  {Observable<Semaphore>}
   * @memberof Semaphore
   */
  public acquire(): Observable<Semaphore> {
    return this._available$.pipe(
      take(1),
      tap(() => {
        this._counter--;
        this._counter$.next(this._counter);
      }),
      map(() => this),
    );
  }

  /**
   * Releases a slot on the semaphore.
   *
   * @memberof Semaphore
   */
  public release() {
    this._counter++;
    this._counter$.next(this._counter);
  }

  /** Resize the semaphore
   *
   *
   * @param {number} max
   * @memberof Semaphore
   */
  public resize(max: number) {
    this._counter += max - this.max;
    this.max = max;
    this._counter$.next(this._counter);
  }
}
