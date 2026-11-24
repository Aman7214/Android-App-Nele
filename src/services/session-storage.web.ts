const key = 'nele-auth-session-v1';

// Keep the cookie fallback in this tab; native builds use SecureStore.
export const sessionStorage = {
  cookieSessionFallback: true,
  async read(): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    try { return window.sessionStorage.getItem(key); } catch { return null; }
  },
  async write(value: string): Promise<void> {
    if (typeof window === 'undefined') return;
    try { window.sessionStorage.setItem(key, value); } catch { /* The SDK can still use its session cookie. */ }
  },
  async remove(): Promise<void> {
    if (typeof window === 'undefined') return;
    try { window.sessionStorage.removeItem(key); } catch { /* Storage can be disabled by the browser. */ }
  },
};
