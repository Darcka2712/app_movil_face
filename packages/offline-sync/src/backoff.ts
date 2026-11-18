export function computeBackoffMs(attempt: number, baseMs = 5000, maxMs = 15 * 60 * 1000): number {
  const exp = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1));
  const jitter = Math.floor(Math.random() * exp * 0.2);
  return exp + jitter;
}
