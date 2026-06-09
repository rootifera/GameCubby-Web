import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { PROXY } from "./env";

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

export function hasActiveTokenFromRequest(req: NextRequest): boolean {
    const token = readTokenFromRequest(req);
    return token ? isJwtActive(token) : false;
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
 * Basic JWT payload validation (expiration check only)
 * Note: This is a temporary fix until proper JWT verification is implemented
 */
export function isJwtActive(token: string): boolean {
    try {
        const parts = token.split(".");
        if (parts.length < 2) return false;
        
        const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const padded = base64 + "===".slice((base64.length + 3) % 4);
        const json = Buffer.from(padded, "base64").toString("utf8");
        const payload = JSON.parse(json) as { exp?: number };
        
        if (typeof payload.exp !== "number") return true; // treat as active if no exp
        const now = Math.floor(Date.now() / 1000);
        return payload.exp > now;
    } catch {
        return false;
    }
}
