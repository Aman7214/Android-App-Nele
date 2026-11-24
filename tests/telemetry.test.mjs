import assert from 'node:assert/strict';
import { test } from 'node:test';
import { trace } from '@opentelemetry/api';

import { traceDatabaseQuery, withRequestTelemetry } from '../functions/api/telemetry.ts';
import { clearRequestTimings, getRecentRequestTimings, recordRequestTiming, setPerformanceReporter } from '../src/services/performance.ts';

test('request timing samples are bounded and reporters cannot mutate or break them', async () => {
  clearRequestTimings();
  setPerformanceReporter(async (timing) => { timing.route = 'changed'; throw new Error('Collector unavailable'); });
  try {
    for (let index = 0; index < 205; index += 1) recordRequestTiming({ route: 'GET listings', durationMs: index, status: 200 });
    const samples = getRecentRequestTimings();
    assert.equal(samples.length, 200);
    assert.equal(samples[0].durationMs, 5);
    assert.equal(samples[0].route, 'GET listings');
    samples[0].route = 'outside mutation';
    assert.equal(getRecentRequestTimings()[0].route, 'GET listings');
    recordRequestTiming({ route: 'GET listings', durationMs: NaN, status: 200 });
    assert.equal(getRecentRequestTimings().length, 200);
    await Promise.resolve();
  } finally { setPerformanceReporter(); clearRequestTimings(); }
});

test('OpenTelemetry instrumentation ends spans and excludes property IDs and query text', async () => {
  const spans = [];
  const tracer = {
    startActiveSpan(name, ...args) {
      const options = args[0];
      const span = {
        name, attributes: { ...options.attributes }, ended: false, exceptions: [],
        setAttribute(key, value) { this.attributes[key] = value; },
        setStatus(value) { this.status = value; },
        recordException(value) { this.exceptions.push(value); },
        end() { this.ended = true; },
      };
      spans.push(span);
      return args.at(-1)(span);
    },
  };
  assert.equal(trace.setGlobalTracerProvider({ getTracer: () => tracer }), true);
  try {
    const handler = withRequestTelemetry(async () => Response.json({ saved: true }));
    const response = await handler(new Request('https://api.example.invalid/saved/private-property?q=private-search', {
      method: 'PUT', headers: { Authorization: 'Bearer private-token' },
    }));
    assert.match(response.headers.get('Server-Timing'), /^api;dur=\d+(\.\d+)?$/);
    assert.equal(spans[0].name, 'PUT /saved/:id');
    assert.equal(spans[0].ended, true);
    assert.equal(spans[0].attributes['http.response.status_code'], 200);
    assert.equal(JSON.stringify(spans[0]).includes('private'), false);
    const error = new Error('Secret database connection details');
    await assert.rejects(traceDatabaseQuery('SELECT', async () => { throw error; }), error);
    assert.equal(spans[1].ended, true);
    assert.equal(spans[1].exceptions[0].message, 'Database query failed');
    assert.equal(JSON.stringify(spans[1]).includes('Secret'), false);
  } finally { trace.disable(); }
});
