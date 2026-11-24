import { context, propagation, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';

const tracer = trace.getTracer('nele-api');

export function withRequestTelemetry(handler: (request: Request) => Promise<Response>) {
  return (request: Request): Promise<Response> => {
    const pathname = new URL(request.url).pathname;
    const route = /^\/saved\/[^/]+\/?$/.test(pathname) ? '/saved/:id'
      : ['/listings', '/saved', '/mine', '/me'].includes(pathname) ? pathname : '/unknown';
    const parent = propagation.extract(context.active(), Object.fromEntries(request.headers));
    return tracer.startActiveSpan(`${request.method} ${route}`, { kind: SpanKind.SERVER, attributes: {
      'http.request.method': request.method, 'http.route': route,
    } }, parent, async (span) => {
      const started = performance.now();
      try {
        const response = await handler(request);
        const durationMs = performance.now() - started;
        response.headers.set('Server-Timing', `api;dur=${durationMs.toFixed(1)}`);
        span.setAttribute('http.response.status_code', response.status);
        if (response.status >= 500) span.setStatus({ code: SpanStatusCode.ERROR });
        if (durationMs >= 500) console.info('nele.slow-request', {
          method: request.method, route, status: response.status, durationMs: Math.round(durationMs),
        });
        return response;
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR });
        // Query parameters, tokens, account fields and database exception text stay out of traces.
        span.recordException({ name: error instanceof Error ? error.name : 'Error', message: 'API request failed' });
        throw error;
      } finally { span.end(); }
    });
  };
}

export function traceDatabaseQuery<T>(operation: string, work: () => Promise<T>): Promise<T> {
  return tracer.startActiveSpan(`database ${operation}`, { kind: SpanKind.CLIENT, attributes: {
    'db.system.name': 'postgresql', 'db.operation.name': operation, 'db.namespace': 'nele',
  } }, async (span) => {
    const started = performance.now();
    try { return await work(); }
    catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.recordException({ name: error instanceof Error ? error.name : 'Error', message: 'Database query failed' });
      throw error;
    } finally {
      const durationMs = performance.now() - started;
      if (durationMs >= 500) console.info('nele.slow-query', { operation, durationMs: Math.round(durationMs) });
      span.end();
    }
  });
}
