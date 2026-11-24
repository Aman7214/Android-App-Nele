export type RequestTiming = { route: string; durationMs: number; status: number };
type Reporter = (timing: RequestTiming) => void | Promise<void>;
let reporter: Reporter | undefined;
const recent: RequestTiming[] = [];

export function setPerformanceReporter(next?: Reporter) { reporter = next; }
export function getRecentRequestTimings(): RequestTiming[] { return recent.map((timing) => ({ ...timing })); }
export function clearRequestTimings() { recent.length = 0; }

export function recordRequestTiming(timing: RequestTiming) {
  // Diagnostics must never interrupt browsing or record account details and search text.
  if (!Number.isFinite(timing.durationMs) || timing.durationMs < 0) return;
  recent.push({ ...timing });
  if (recent.length > 200) recent.shift();
  try {
    // Browser Performance recordings can inspect API timings without an external service.
    if (typeof document !== 'undefined' && typeof performance.measure === 'function') {
      const name = `nele.api ${timing.route}`;
      const end = performance.now();
      if (performance.getEntriesByName(name, 'measure').length >= 50) performance.clearMeasures(name);
      performance.measure(name, { start: Math.max(0, end - timing.durationMs), end, detail: { status: timing.status } });
    }
  } catch { /* Timing support varies across browsers. */ }
  try {
    if (reporter) void Promise.resolve(reporter({ ...timing })).catch(() => {});
  } catch { /* A monitoring outage does not fail an app request. */ }
}
