import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { PROXY } from "./env";
import { SESSION_PROOF_COOKIE, isSessionActive } from "./session";

/**
 * Shared authentication utilities for consistent token handling across routes
 */

/**
 * Determines if cookies should be secure based on PROXY setting and request protocol
 * @param req - The NextRequest object
 * @returns true if cookies should be secure, false otherwise
 */
export function shouldUseSecureCookies(req: NextRequest): boolean {
    const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
    return PROXY || forwardedProto === "https" || req.nextUrl.protocol === "https:";
}

export async function readToken(): Promise<string> {
    const cookieStore = await cookies();
    return cookieStore.get("__gcub_a")?.value || cookieStore.get("gc_at")?.value || "";
}

export function readTokenFromRequest(req: NextRequest): string {
    return req.cookies.get("__gcub_a")?.value || req.cookies.get("gc_at")?.value || "";
}

/** True if the request carries an unexpired admin token that we issued (see lib/session.ts). */
export function hasActiveTokenFromRequest(req: NextRequest): boolean {
    return isSessionActive(readTokenFromRequest(req), req.cookies.get(SESSION_PROOF_COOKIE)?.value);
}

/** Same check for server components / route handlers that read cookies via next/headers. */
export async function hasValidSession(): Promise<boolean> {
    const cookieStore = await cookies();
    const token = cookieStore.get("__gcub_a")?.value || cookieStore.get("gc_at")?.value || "";
    return isSessionActive(token, cookieStore.get(SESSION_PROOF_COOKIE)?.value);
}

export async function requireAuth(): Promise<string> {
    const token = await readToken();
    if (!token) {
        throw new Error("Authentication required");
    }
    return token;
}

export function requireAuthFromRequest(req: NextRequest): string {
    const token = readTokenFromRequest(req);
    if (!token) {
        throw new Error("Authentication required");
    }
    return token;
}

/**
 * Restrict a user-supplied post-login redirect to a same-site path.
 * Rejects absolute/protocol-relative URLs ("//evil.com"), backslashes ("/\\evil.com",
 * which browsers treat as "//evil.com") and control characters (browsers strip tabs
 * and newlines inside URLs, so "/\t/evil.com" would become "//evil.com").
 */
export function safeNextPath(value: string | null | undefined, fallback = "/admin"): string {
    const v = String(value ?? "");
    if (!v.startsWith("/") || v.startsWith("//")) return fallback;
    if (/[\\\u0000-\u001f\u007f]/.test(v)) return fallback;
    return v;
}

/**
 * The visitor's real IP, for the API's login rate limit. Without this the API only ever sees this
 * web server's address, so three bad guesses from anyone (a scanner, an attacker) locked the real
 * admin out too.
 *
 * Only trusted when PROXY=true (the app sits behind a reverse proxy that sets X-Forwarded-For): a
 * client talking to the web port directly could otherwise forge the header to dodge the limit.
 * TRUSTED_PROXY_HOPS (default 1) is how many proxies append to X-Forwarded-For; the entry that many
 * from the right is the client as seen by the first trusted proxy.
 */
export function trustedClientIp(req: NextRequest): string | null {
    if (!PROXY) return null;
    const chain = (req.headers.get("x-forwarded-for") || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (chain.length === 0) return null;
    const hops = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS || 1) || 1);
    const candidate = chain[Math.max(0, chain.length - hops)];
    return /^[0-9a-fA-F:.]{3,45}$/.test(candidate) ? candidate : null;
}
