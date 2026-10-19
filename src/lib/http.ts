// src/lib/http.ts
//
// Fetch helpers for talking to the GameCubby API (or anything behind it) from route
// handlers. A bare `fetch` has no timeout and keeps running after the visitor goes away,
// so a stuck upstream pins a request, a socket and memory forever.

/** Normal request/response call (the body is read by the caller): one deadline for everything. */
export function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 15_000, clientSignal?: AbortSignal): Promise<Response> {
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = clientSignal ? AbortSignal.any([timeout, clientSignal]) : timeout;
    return fetch(url, { ...init, signal });
}

/**
 * Streaming call (large downloads): the timeout only covers waiting for the response
 * headers; once they arrive the body may take as long as it needs -- but it is cancelled
 * as soon as the visitor disconnects (`clientSignal`), instead of being pulled to the end.
 */
export async function fetchStream(url: string, init: RequestInit = {}, headersTimeoutMs = 30_000, clientSignal?: AbortSignal): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new DOMException("Upstream timed out", "TimeoutError")), headersTimeoutMs);
    const onClientAbort = () => controller.abort();
    if (clientSignal) {
        if (clientSignal.aborted) controller.abort();
        else clientSignal.addEventListener("abort", onClientAbort, { once: true });
    }
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

/** Passes a body through but errors out once it exceeds `maxBytes` (guards against unexpectedly large upstreams). */
export function capStream(body: ReadableStream<Uint8Array>, maxBytes: number): ReadableStream<Uint8Array> {
    let seen = 0;
    return body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
            seen += chunk.byteLength;
            if (seen > maxBytes) {
                controller.error(new Error("Upstream body too large"));
                return;
            }
            controller.enqueue(chunk);
        },
    }));
}

/** Only same-scheme http(s) redirect targets are followed on the visitor's behalf. */
export function safeRedirectTarget(location: string, base: string): URL | null {
    try {
        const url = new URL(location, base);
        return url.protocol === "http:" || url.protocol === "https:" ? url : null;
    } catch {
        return null;
    }
}
