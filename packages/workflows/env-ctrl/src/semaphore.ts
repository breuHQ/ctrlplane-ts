type PlaceholderFn = () => void;

export class Semaphore {
  private _available: number;
  // eslint-disable-next-line @typescript-eslint/ban-types
  private _upcoming: Function[];
  // eslint-disable-next-line @typescript-eslint/ban-types
  private _heads: Function[];

  private _completeFn!: PlaceholderFn;
  private _completePr!: Promise<void>;

  constructor(public max: number) {
    if (max <= 0) throw new Error('size must be positive');
    this._available = max;
    this._upcoming = [];
    this._heads = [];
    this._refreshComplete();
  }

  /**
   * Resizes the semaphore to the specified size.
   *
   * @param {number} max The new size of the semaphore.
   * @memberof Semaphore
   */
  public resize(max: number) {
    this.max = max;
  }

  /**
   * Executes a function and returns a promise that resolves when the function completes.
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
   * Returns the current queue of functions.
   *
   * @private
   * @returns {Function[]} The current queue of functions.
   * @memberof Semaphore
   */
  // eslint-disable-next-line @typescript-eslint/ban-types
  private _queue(): Function[] {
    if (!this._heads.length) {
      this._heads = this._upcoming.reverse();
      this._upcoming = [];
    }
    return this._heads;
  }

  private _acquire(): void | Promise<void> {
    if (this._available > 0) {
      this._available -= 1;
      return undefined;
    } else {
      let fn: PlaceholderFn = () => {
        /***/
      };
      const defer = new Promise<void>(resolve => {
        fn = resolve;
      });
      this._upcoming.push(fn);
      return defer;
    }
  }

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

  private _refreshComplete(): void {
    let fn: PlaceholderFn = () => {
      /***/
    };
    this._completePr = new Promise<void>(resolve => {
      fn = resolve;
    });
    this._completeFn = fn;
  }
}
