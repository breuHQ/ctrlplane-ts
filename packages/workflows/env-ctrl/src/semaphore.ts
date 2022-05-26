/* eslint-disable @typescript-eslint/ban-types */

type VoidFn = () => void;

/**
 * Given a number, creates a semaphore that can be used to limit the number of concurrent executions.
 *
 * @export
 * @class Semaphore
 */
export class Semaphore {
  /**
   * Available semaphore slots.
   *
   * @private
   * @type {number}
   * @memberof Semaphore
   */
  private _available: number;

  /**
   * Executions that are in the queue.
   *
   * @private
   * @type {Function[]}
   * @memberof Semaphore
   */
  private _upcoming: Function[];

  /**
   * Exections that are being executed
   *
   * @private
   * @type {Function[]}
   * @memberof Semaphore
   */
  private _heads: Function[];

  private _completeFn!: VoidFn;
  private _completePr!: Promise<void>;

  /**
   * Creates an instance of Semaphore.
   * @param {number} max The maximum number of concurrent executions.
   * @memberof Semaphore
   */
  constructor(public max: number) {
    if (max <= 0) throw new Error('size must be positive');
    this._available = max;
    this._upcoming = [];
    this._heads = [];
    this._refreshComplete();
  }

  /**
   * Wait for the semaphore to be empty and then execute the function. The result of the function is returned
   * upon completion.
   *
   * @template A The return type of the function.
   * @param {() => Promise<A>} fn The function to execute.
   * @returns {Promise<A>} A promise that resolves when the function completes.
   * @memberof Semaphore
   */
  public async fire<A>(fn: () => Promise<A>): Promise<A> {
    await this._acquire();
    return this._execWithRelease(fn);
  }

  /**
   * Executes the function but ignores the result.
   *
   * @template A The return type of the function.
   * @param {() => Promise<A>} fn The function to execute.
   * @returns {Promise<void>} A promise that resolves when the function completes.
   * @memberof Semaphore
   */
  public async fireAndForget<A>(fn: () => Promise<A>): Promise<void> {
    await this._acquire();
    // Ignoring returned promise on purpose!
    this._execWithRelease(fn);
  }

  /**
   * Returns a promise that resolves when the semaphore is empty.
   *
   * @returns {Promise<void>} A promise that resolves when the semaphore is empty.
   * @memberof Semaphore
   */
  public async awaitTerminate(): Promise<void> {
    if (this._available < this.max) {
      return this._completePr;
    }
  }

  /**
   * Resizes the semaphore to the specified size.
   *
   * @param {number} max The new size of the semaphore.
   * @memberof Semaphore
   */
  public resize(max: number) {
    this._available += max - this.max;
    this.max = max;
  }

  /**
   * Executes the function and releases the semaphore.
   *
   * @private
   * @template A The return type of the function.
   * @param {() => Promise<A>} fn The function to execute.
   * @returns {Promise<A>} A promise that resolves when the function completes.
   * @memberof Semaphore
   */
  private async _execWithRelease<A>(fn: () => Promise<A>): Promise<A> {
    try {
      return await fn();
    } finally {
      this._release();
    }
  }

  /**
   * Returns the current queue of pending functions.
   *
   * @private
   * @returns {Function[]} The current queue of functions.
   * @memberof Semaphore
   */
  private _queue(): Function[] {
    if (!this._heads.length) {
      this._heads = this._upcoming.reverse();
      this._upcoming = [];
    }
    return this._heads;
  }

  /**
   * Acquires the semaphore and executes the function.
   *
   * @private
   * @returns {(void | Promise<void>)}
   * @memberof Semaphore
   */
  private _acquire(): void | Promise<void> {
    if (this._available > 0) {
      this._available -= 1;
      return undefined;
    } else {
      let fn: VoidFn = () => {
        /***/
      };
      const defer = new Promise<void>(resolve => {
        fn = resolve;
      });
      this._upcoming.push(fn);
      return defer;
    }
  }

  /**
   * Releases the semaphore when the function completes.
   *
   * @private
   * @memberof Semaphore
   */
  private _release(): void {
    const queue = this._queue();
    if (queue.length) {
      const fn = queue.pop();
      if (fn) fn();
    } else {
      this._available += 1;

      if (this._available >= this.max) {
        const fn = this._completeFn;
        this._refreshComplete();
        fn();
      }
    }
  }

  /**
   * Refreshes the promise that resolves when the semaphore is empty.
   *
   * @private
   * @memberof Semaphore
   */
  private _refreshComplete(): void {
    let fn: VoidFn = () => {
      /***/
    };
    this._completePr = new Promise<void>(resolve => {
      fn = resolve;
    });
    this._completeFn = fn;
  }
}
