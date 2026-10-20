// src/lib/security.ts
//
// Security headers and CSRF defence used by proxy.ts. Kept free of Node-only imports so it can
// be unit tested and reused.

import type { NextRequest } from "next/server";

/**
 * CSP_MODE=enforce (default) | report-only | off
 * `report-only` only logs violations in the browser console; `off` is the emergency switch if a
 * policy ever breaks something in a deployment.
 */
export type CspMode = "enforce" | "report-only" | "off";

export function cspMode(): CspMode {
    const v = (process.env.CSP_MODE || "enforce").trim().toLowerCase();
    return v === "off" || v === "report-only" ? v : "enforce";
}

export function cspHeaderName(mode: CspMode): string {
    return mode === "report-only" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";
}

/** Fresh, unguessable per-request value (base64 of a random UUID). */
export function newNonce(): string {
    return btoa(crypto.randomUUID());
}

/**
 * The policy. Scripts need the per-request nonce ('strict-dynamic' lets those scripts load the
 * Next.js chunks they depend on), so injected inline script is blocked. Inline style *attributes*
 * are allowed because the UI is styled with them; inline style *elements* need the nonce.
 * Images may come from any http(s) host: game covers can be external IGDB URLs.
 * No `upgrade-insecure-requests`: the app is also used over plain http on the LAN.
 */
export function buildCsp(nonce: string): string {
    return [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
        `style-src 'self' 'nonce-${nonce}'`,
        "style-src-attr 'unsafe-inline'",
        "img-src 'self' data: blob: https: http:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'self'",
    ].join("; ");
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defence for state-changing requests (POST/PUT/PATCH/DELETE): the browser-supplied `Origin`
 * must be this site. Cookies are already SameSite=Strict; this covers the remaining cases (other
 * subdomains of the same site, older browsers) and the login form itself.
 *
 *  - No Origin header: non-browser clients (curl, scripts) -> allowed, unless the browser says
 *    `Sec-Fetch-Site: cross-site`.
 *  - Behind a reverse proxy the public host arrives in X-Forwarded-Host (or the preserved Host).
 *  - ALLOWED_ORIGINS="https://a.example,https://b.example" adds extra trusted origins, and
 *    CSRF_ORIGIN_CHECK=off disables the check (for a proxy that rewrites Host).
 */
export function isCrossSiteWrite(req: NextRequest): boolean {
    if (SAFE_METHODS.has(req.method)) return false;
    if ((process.env.CSRF_ORIGIN_CHECK || "").trim().toLowerCase() === "off") return false;

    const origin = req.headers.get("origin");
    if (!origin) return req.headers.get("sec-fetch-site") === "cross-site";
    if (origin === "null") return true;

    let originHost: string;
    try {
        originHost = new URL(origin).host.toLowerCase();
    } catch {
        return true;
    }
    const host = (req.headers.get("x-forwarded-host")?.split(",")[0] || req.headers.get("host") || "").trim().toLowerCase();
    if (host && originHost === host) return false;

    const extra = (process.env.ALLOWED_ORIGINS || "")
        .split(",")
        .map((s) => s.trim().toLowerCase().replace(/\/+$/, ""))
        .filter(Boolean);
    return !extra.includes(origin.toLowerCase().replace(/\/+$/, ""));
}
