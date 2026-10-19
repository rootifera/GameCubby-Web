// src/lib/session.ts
//
// Server-side proof that an admin session cookie was really issued by us.
//
// The admin cookie holds the API's JWT, but the web app can't verify that JWT's
// signature (the secret lives in the API's database, which is unavailable during a
// restore -- exactly when the sentinel routes must still work). Decoding the payload
// and checking `exp` is not authentication: anyone can hand-craft such a token.
//
// Instead, right after the API accepts a login, we set a second HttpOnly cookie
// holding HMAC(secret, token). A session is only valid if the proof matches, which
// can't be forged without the secret. It needs no database, so it keeps working in
// maintenance mode.
//
// The secret is random, stored in a 0600 file next to the maintenance file so it
// survives restarts. Used by both proxy.ts and route handlers (Node runtime).

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const SESSION_PROOF_COOKIE = "__gcub_s";

const MAINT_FILE = process.env.GC_MAINT_FILE || "/storage/maintenance.json";
const KEY_FILE = process.env.GC_SESSION_KEY_FILE || path.join(path.dirname(MAINT_FILE), "session.key");

// Shared across module instances (proxy and route handlers may be bundled separately).
const globalStore = globalThis as typeof globalThis & { __gcSessionKey?: Buffer };

function loadKey(): Buffer {
    if (globalStore.__gcSessionKey) return globalStore.__gcSessionKey;

    let key: Buffer | null = null;
    try {
        const existing = Buffer.from(fs.readFileSync(KEY_FILE, "utf8").trim(), "hex");
        if (existing.length >= 32) key = existing;
    } catch {
        // missing or unreadable: create below
    }

    if (!key) {
        const fresh = crypto.randomBytes(32);
        try {
            fs.mkdirSync(path.dirname(KEY_FILE), { recursive: true });
            // "wx": fail if another process created it first, then read theirs.
            fs.writeFileSync(KEY_FILE, fresh.toString("hex"), { mode: 0o600, flag: "wx" });
            key = fresh;
        } catch {
            try {
                const raced = Buffer.from(fs.readFileSync(KEY_FILE, "utf8").trim(), "hex");
                if (raced.length >= 32) key = raced;
            } catch {
                // fall through to in-memory key
            }
        }
        if (!key) {
            console.warn(`[session] cannot persist ${KEY_FILE}; using an in-memory key (admins must log in again after a restart).`);
            key = fresh;
        }
    }

    globalStore.__gcSessionKey = key;
    return key;
}

/** HMAC proof to store alongside a freshly issued token. */
export function signSessionProof(token: string): string {
    return crypto.createHmac("sha256", loadKey()).update(token).digest("base64url");
}

function tokenNotExpired(token: string): boolean {
    try {
        const parts = token.split(".");
        if (parts.length < 2) return false;
        const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { exp?: number };
        // A token without `exp` is never accepted.
        return typeof payload.exp === "number" && payload.exp > Math.floor(Date.now() / 1000);
    } catch {
        return false;
    }
}

/** True only if `token` is unexpired AND `proof` shows we issued it. */
export function isSessionActive(token: string | undefined | null, proof: string | undefined | null): boolean {
    if (!token || !proof || !tokenNotExpired(token)) return false;
    const expected = Buffer.from(signSessionProof(token));
    const given = Buffer.from(proof);
    return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}
