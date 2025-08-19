// src/app/sentinel/bootstrapOnStart.ts
// Server-only helper to ensure the MAINT_DB_USER exists (and has LOGIN + SUPERUSER)
// on the first admin request after the app starts.

import { spawn } from "node:child_process";

declare global {
    // Prevent running more than once per server process
    // eslint-disable-next-line no-var
    var __gc_sentinel_bootstrap_promise: Promise<void> | undefined;
}

function runPsql(args: string[], env: Record<string, string>): Promise<{ code: number; out: string; err: string }> {
    return new Promise((resolve) => {
        const child = spawn("psql", args, { env: { ...process.env, ...env } });
        let out = "";
        let err = "";
        child.stdout.on("data", (d) => (out += d.toString()));
        child.stderr.on("data", (d) => (err += d.toString()));
        child.on("close", (code) => resolve({ code: code ?? 0, out, err }));
    });
}

async function ensureMaintUserOnce(): Promise<void> {
    const enabled = (process.env.GC_SENTINEL_BOOTSTRAP_ON_START || "yes").toLowerCase();
    if (enabled !== "yes" && enabled !== "true" && enabled !== "1") {
        return; // disabled via env
    }

    const DB_HOST = process.env.DB_HOST || "gamecubby-db";
    const DB_PORT = String(process.env.DB_PORT || "5432");
    const DB_USER = process.env.DB_USER || "gamecubby";         // superuser/app admin
    const DB_PASSWORD = process.env.DB_PASSWORD || "";          // used to connect

    const MAINT_USER = process.env.MAINT_DB_USER || "gc_maint";
    const MAINT_PASSWORD = process.env.MAINT_DB_PASSWORD || "";

    // If we don't have creds, quietly skip (no crashes at boot)
    if (!DB_PASSWORD || !MAINT_PASSWORD) return;

    try {
        // 1) Check if the role exists
        const check = await runPsql(
            ["-h", DB_HOST, "-p", DB_PORT, "-U", DB_USER, "-d", "postgres", "-tAc", `SELECT 1 FROM pg_roles WHERE rolname='${MAINT_USER.replace(/'/g, "''")}'`],
            { PGPASSWORD: DB_PASSWORD }
        );
        if (check.code !== 0) {
            // Don’t throw — avoid failing the app on startup
            console.warn("[Sentinel bootstrap] psql check failed:", check.err || check.out);
            return;
        }
        const exists = check.out.trim().startsWith("1");

        // 2) Create or alter role
        const pwLit = MAINT_PASSWORD.replace(/'/g, "''");
        const roleLit = MAINT_USER.replace(/"/g, '""');
        const sql = exists
            ? `ALTER ROLE "${roleLit}" WITH LOGIN SUPERUSER PASSWORD '${pwLit}';`
            : `CREATE ROLE "${roleLit}" WITH LOGIN SUPERUSER PASSWORD '${pwLit}';`;

        const apply = await runPsql(
            ["-h", DB_HOST, "-p", DB_PORT, "-U", DB_USER, "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", sql],
            { PGPASSWORD: DB_PASSWORD }
        );
        if (apply.code !== 0) {
            console.warn("[Sentinel bootstrap] psql apply failed:", apply.err || apply.out);
            return;
        }

        console.log(`[Sentinel bootstrap] Maintenance user ${MAINT_USER} ${exists ? "updated" : "created"}.`);
    } catch (e) {
        console.warn("[Sentinel bootstrap] ensureMaintUserOnce error:", (e as Error).message);
    }
}

/**
 * Call this once from a server component (e.g., admin layout) to ensure
 * the maintenance user is present after server start.
 */
export async function bootstrapOnce(): Promise<void> {
    if (!globalThis.__gc_sentinel_bootstrap_promise) {
        globalThis.__gc_sentinel_bootstrap_promise = ensureMaintUserOnce();
    }
    return globalThis.__gc_sentinel_bootstrap_promise;
}
