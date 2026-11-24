import type { z } from 'zod';

import { accessToken, expireSession, sessionGeneration } from './auth';
import { recordRequestTiming } from './performance.ts';
import { createRequestCoordinator, waitForSignal } from '../utils/shared-request.ts';

const apiUrl = process.env.EXPO_PUBLIC_NEON_API_URL;

export class RequestError extends Error {
  readonly status: number;
  constructor(message: string, status = 0) { super(message); this.status = status; }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  userId?: string | null;
  signal?: AbortSignal;
  timeoutMs?: number;
};

type ApiResponse = { data: unknown; status: number; ok: boolean };
const sharedReads = createRequestCoordinator<ApiResponse>();

function timingRoute(method: string, pathname: string) {
  const path = pathname.replace(/\/$/, '').replace(/^\//, '').split(/[?#]/, 1)[0];
  const route = /^saved\/[a-zA-Z0-9_-]+$/.test(path) ? 'saved/:id'
    : /^listings\/[a-zA-Z0-9_-]+\/status$/.test(path) ? 'listings/:id/status'
      : /^listings\/[a-zA-Z0-9_-]+$/.test(path) ? 'listings/:id'
        : /^conversations\/[a-zA-Z0-9_-]+\/messages$/.test(path) ? 'conversations/:id/messages'
          : /^conversations\/[a-zA-Z0-9_-]+$/.test(path) ? 'conversations/:id'
            : ['listings', 'saved', 'mine', 'me', 'uploads', 'conversations'].includes(path) ? path : 'unknown';
  return `${['GET', 'POST', 'PUT', 'DELETE'].includes(method) ? method : 'OTHER'} ${route}`;
}

export async function requestApi<T>(path: string, schema: z.ZodType<T>, options: RequestOptions = {}): Promise<T> {
  if (!apiUrl) throw new RequestError('The property connection is not configured yet.');
  const url = new URL(path, apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  url.searchParams.sort();
  const generation = sessionGeneration();
  const method = options.method?.toUpperCase() ?? 'GET';
  const timeoutMs = options.timeoutMs ?? 20_000;
  const work = async (signal: AbortSignal): Promise<ApiResponse> => {
    const started = performance.now();
    let status = 0;
    let timedOut = false;
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    // The deadline covers session refresh, fetch and response parsing together.
    const timeout = setTimeout(() => { timedOut = true; abort(); }, timeoutMs);
    try {
      if (controller.signal.aborted) { const error = new Error('Cancelled'); error.name = 'AbortError'; throw error; }
      const headers = new Headers({ Accept: 'application/json' });
      if (options.body !== undefined) headers.set('Content-Type', 'application/json');
      if (options.userId) headers.set('Authorization', `Bearer ${await waitForSignal(accessToken(options.userId), controller.signal)}`);
      if (controller.signal.aborted) { const error = new Error('Cancelled'); error.name = 'AbortError'; throw error; }
      const response = await waitForSignal(fetch(url.toString(), {
        method, headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      }), controller.signal);
      status = response.status;
      const data: unknown = await waitForSignal(response.json().catch(() => null), controller.signal);
      if (!response.ok) {
        const message = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
          ? data.error : 'The connection failed. Please try again.';
        if (response.status === 401 && options.userId) await expireSession(options.userId, generation);
        throw new RequestError(message, response.status);
      }
      return { data, status, ok: response.ok };
    } catch (error) {
      if (error instanceof RequestError) throw error;
      if (signal.aborted) throw error;
      if (timedOut) { status = 408; throw new RequestError('The request took too long. Please try again.', 408); }
      throw new RequestError('Check your connection and try again.');
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
      recordRequestTiming({ route: timingRoute(method, path), durationMs: performance.now() - started, status });
    }
  };
  const result = method === 'GET'
    ? await sharedReads(JSON.stringify([url.href, options.userId ?? null, generation, timeoutMs]), work, options.signal)
    : await work(options.signal ?? new AbortController().signal);
  const parsed = schema.safeParse(result.data);
  if (!parsed.success) throw new RequestError('The app received an unexpected response. Please try again.');
  return parsed.data;
}

/**
 * Multipart variant of {@link requestApi}. Used for photos and documents, where
 * the body is a `FormData` the runtime streams with its own boundary — never set
 * `Content-Type` by hand here.
 */
export async function requestApiForm<T>(
  path: string,
  form: FormData,
  schema: z.ZodType<T>,
  userId: string,
  options: { timeoutMs?: number } = {},
): Promise<T> {
  if (!apiUrl) throw new RequestError('The property connection is not configured yet.');
  const url = new URL(path, apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`);
  const generation = sessionGeneration();
  const timeoutMs = options.timeoutMs ?? 120_000;
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  const started = performance.now();
  let status = 0;
  try {
    const headers = new Headers({ Accept: 'application/json' });
    headers.set('Authorization', `Bearer ${await waitForSignal(accessToken(userId), controller.signal)}`);
    const response = await fetch(url.toString(), {
      method: 'POST', headers, body: form, signal: controller.signal,
    });
    status = response.status;
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error : 'The upload failed. Please try again.';
      if (response.status === 401) await expireSession(userId, generation);
      throw new RequestError(message, response.status);
    }
    const parsed = schema.safeParse(data);
    if (!parsed.success) throw new RequestError('The app received an unexpected response. Please try again.');
    return parsed.data;
  } catch (error) {
    if (error instanceof RequestError) throw error;
    if (timedOut) throw new RequestError('The upload took too long. Please try again.', 408);
    throw new RequestError('Check your connection and try again.');
  } finally {
    clearTimeout(timeout);
    recordRequestTiming({ route: timingRoute('POST', path), durationMs: performance.now() - started, status });
  }
}
