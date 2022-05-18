type PlaceholderFn = () => void;

export class Semaphore {
  private _available: number;
  // eslint-disable-next-line @typescript-eslint/ban-types
  private _upcoming: Function[];
  // eslint-disable-next-line @typescript-eslint/ban-types
  private _heads: Function[];

  private _completeFn!: PlaceholderFn;
  private _completePr!: Promise<void>;

  constructor(public readonly workersCount: number) {
    if (workersCount <= 0) throw new Error('workersCount must be positive');
    this._available = workersCount;
    this._upcoming = [];
    this._heads = [];
    this._refreshComplete();
  }

  async fire<A>(f: () => Promise<A>): Promise<A> {
    await this._acquire();
    return this._execWithRelease(f);
  }

  async fireAndForget<A>(f: () => Promise<A>): Promise<void> {
    await this._acquire();
    // Ignoring returned promise on purpose!
    this._execWithRelease(f);
  }

  async awaitTerminate(): Promise<void> {
    if (this._available < this.workersCount) {
      return this._completePr;
    }
  }

  private async _execWithRelease<A>(f: () => Promise<A>): Promise<A> {
    try {
      return await f();
    } finally {
      this._release();
    }
  }

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

      if (this._available >= this.workersCount) {
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
