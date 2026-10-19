// src/lib/maintenance.ts
//
// Single reader for the maintenance flag file (shared with the API via ./storage).
// The file is the source of truth: proxy.ts reads it directly on each request instead
// of trusting a browser cookie (which could outlive maintenance by hours) or calling
// its own server over HTTP.

import fs from "node:fs";

const MAINT_FILE = process.env.GC_MAINT_FILE || "/storage/maintenance.json";

export const DEFAULT_MAINT_ALLOW = ["/admin/sentinel/restore", "/api/sentinel/", "/health", "/_next/"];

export type MaintenanceState = {
    enabled: boolean;
    reason: string | null;
    by: string | null;
    started_at: string | null;
    allow: string[];
};

// A request burst (page + dozens of assets) shouldn't each hit the disk, but the flag must
// still flip within a moment. Kept on globalThis so proxy and route handlers share it.
const CACHE_MS = 500;
const store = globalThis as typeof globalThis & { __gcMaint?: { at: number; value: MaintenanceState } };

function strOrNull(v: unknown): string | null {
    return typeof v === "string" ? v : null;
}

function readFromDisk(): MaintenanceState {
    try {
        const j = JSON.parse(fs.readFileSync(MAINT_FILE, "utf8")) as Record<string, unknown>;
        return {
            enabled: j?.enabled === true,
            reason: strOrNull(j?.reason),
            by: strOrNull(j?.by),
            started_at: strOrNull(j?.started_at),
            allow: Array.isArray(j?.allow) ? (j.allow as unknown[]).filter((v): v is string => typeof v === "string") : DEFAULT_MAINT_ALLOW,
        };
    } catch {
        // missing or unreadable -> not in maintenance (same fail-open behaviour as before)
        return { enabled: false, reason: null, by: null, started_at: null, allow: DEFAULT_MAINT_ALLOW };
    }
}

export function readMaintenance(opts: { fresh?: boolean } = {}): MaintenanceState {
    const now = Date.now();
    if (!opts.fresh && store.__gcMaint && now - store.__gcMaint.at < CACHE_MS) return store.__gcMaint.value;
    const value = readFromDisk();
    store.__gcMaint = { at: now, value };
    return value;
}

/** Call right after writing/removing the flag file so the change is visible immediately. */
export function invalidateMaintenanceCache(): void {
    store.__gcMaint = undefined;
}
