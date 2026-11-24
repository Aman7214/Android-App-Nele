function abortError() { const error = new Error('The request was cancelled.'); error.name = 'AbortError'; return error; }

export function waitForSignal<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    void promise.catch(() => {});
    return Promise.reject(abortError());
  }
  return new Promise((resolve, reject) => {
    const abort = () => { cleanup(); reject(abortError()); };
    const cleanup = () => signal.removeEventListener('abort', abort);
    signal.addEventListener('abort', abort, { once: true });
    promise.then((value) => { cleanup(); resolve(value); }, (error: unknown) => { cleanup(); reject(error); });
  });
}

/** Share one request while keeping each screen's cancellation independent. */
export function createRequestCoordinator<T>() {
  const requests = new Map<string, { controller: AbortController; promise: Promise<T>; subscribers: number }>();
  return async (key: string, work: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> => {
    if (signal?.aborted) throw abortError();
    let entry = requests.get(key);
    if (!entry || entry.controller.signal.aborted) {
      const controller = new AbortController();
      const promise = Promise.resolve().then(() => {
        if (controller.signal.aborted) throw abortError();
        return work(controller.signal);
      });
      entry = { controller, promise, subscribers: 0 };
      requests.set(key, entry);
      const current = entry;
      const cleanup = () => { if (requests.get(key) === current) requests.delete(key); };
      void promise.then(cleanup, cleanup);
    }
    const active = entry;
    active.subscribers += 1;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      active.subscribers -= 1;
      if (active.subscribers === 0) active.controller.abort();
    };
    signal?.addEventListener('abort', release, { once: true });
    try { return await (signal ? waitForSignal(active.promise, signal) : active.promise); }
    finally {
      signal?.removeEventListener('abort', release);
      release();
    }
  };
}

export function singleFlight<Args extends unknown[], T>(work: (...args: Args) => Promise<T>) {
  const pending = new Map<string, Promise<T>>();
  return (key: string, ...args: Args): Promise<T> => {
    const existing = pending.get(key);
    if (existing) return existing;
    const promise = Promise.resolve().then(() => work(...args));
    pending.set(key, promise);
    const cleanup = () => { if (pending.get(key) === promise) pending.delete(key); };
    void promise.then(cleanup, cleanup);
    return promise;
  };
}
