/** Install the web API subset that the managed auth client uses on native. */
export function installNativeAuthRuntime(randomUUID: () => string) {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    const crypto = globalThis.crypto ?? {};
    Object.defineProperty(crypto, 'randomUUID', { value: randomUUID, configurable: true, writable: true });
    if (!globalThis.crypto) {
      Object.defineProperty(globalThis, 'crypto', { value: crypto, configurable: true, writable: true });
    }
  }

  if (typeof Response.json !== 'function') {
    Object.defineProperty(Response, 'json', {
      configurable: true,
      writable: true,
      value: (value: unknown, init: ResponseInit = {}) => {
        const body = JSON.stringify(value);
        if (body === undefined) throw new TypeError('The response must be JSON serializable.');
        const headers = new Headers(init.headers);
        if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
        return new Response(body, { ...init, headers });
      },
    });
  }
}
