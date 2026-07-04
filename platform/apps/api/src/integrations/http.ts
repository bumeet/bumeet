const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * fetch with a mandatory timeout. Every outbound provider call must go through
 * this: getLiveStatus() fans out to all connected providers on every agent poll
 * (~5 s), so a single hung provider connection with no timeout would pile up
 * requests and stall the whole presence pipeline.
 */
export function providerFetch(
  url: string | URL,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  return fetch(url, { ...init, signal: init.signal ?? AbortSignal.timeout(timeoutMs) });
}
