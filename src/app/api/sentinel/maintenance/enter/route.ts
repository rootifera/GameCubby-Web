// src/app/api/sentinel/maintenance/enter/route.ts
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { hasActiveTokenFromRequest, readTokenFromRequest } from "@/lib/auth";
import { invalidateMaintenanceCache } from "@/lib/maintenance";
import type { S3BackupConfig } from "@/lib/s3Backup";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

// Maintenance flag file (shared via ./storage:/storage)
const DEFAULT_MAINT_PATH = "/storage/maintenance.json";
const MAINT_FILE = process.env.GC_MAINT_FILE || DEFAULT_MAINT_PATH;
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://gamecubby-api:8000";

type MaintJson = {
    enabled: boolean;
    reason?: string | null;
    by?: string | null;
    started_at?: string | null;
    allow?: string[];         // routes that remain reachable while in maintenance
    nonce?: string;           // optional, if you ever want to rotate a guard token
    backup_storage?: S3BackupConfig | { backend: "local" };
};

async function loadBackupStorage(req: NextRequest): Promise<MaintJson["backup_storage"]> {
    const res = await fetch(`${API_BASE}/app_config/`, {
        cache: "no-store",
        headers: {
            Accept: "application/json",
            Authorization: `Bearer ${readTokenFromRequest(req)}`,
        },
    });
    if (!res.ok) {
        const error = new Error(
            res.status === 401
                ? "Your admin session is no longer valid. Sign in again before enabling maintenance."
                : `Unable to read backup storage configuration (${res.status})`
        ) as Error & { status?: number };
        error.status = res.status;
        throw error;
    }
    const entries = await res.json() as Array<{ key?: string; value?: string }>;
    const values = new Map(entries.map((entry) => [entry.key || "", entry.value || ""]));
    const backend = (values.get("backup_storage_backend") || "local").toLowerCase();
    if (backend !== "s3") return { backend: "local" };

    const bucket = values.get("s3_bucket") || "";
    if (!bucket) throw new Error("S3 backup storage is selected but s3_bucket is not configured");
    return {
        backend: "s3",
        bucket,
        prefix: values.get("s3_prefix") || "",
        endpoint_url: values.get("s3_endpoint_url") || "",
        region: values.get("s3_region") || "",
        access_key_id: values.get("s3_access_key_id") || "",
        secret_access_key: values.get("s3_secret_access_key") || "",
    };
}

export async function POST(req: NextRequest) {
    // ---- Admin check (same cookie as /admin) ----
    if (!hasActiveTokenFromRequest(req)) {
        return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    // ---- Parse optional body ----
    type Body = { reason?: string; by?: string; allow?: string[] };
    let body: Body = {};
    try {
        if (req.headers.get("content-type")?.includes("application/json")) {
            body = (await req.json()) as Body;
        }
    } catch {
        /* ignore bad JSON */
    }

    const reason = (body.reason || "").slice(0, 500);
    const by = (body.by || "admin").slice(0, 120);
    const allow = Array.isArray(body.allow) && body.allow.length
        ? body.allow.filter((s) => typeof s === "string").slice(0, 50)
        : [
            "/admin/login",
            "/admin/logout",
            "/admin/sentinel/restore",
            "/api/sentinel/",
            "/api/health",
            "/_next/",
            "/favicon.ico",
            "/robots.txt",
            "/sitemap.xml",
        ];

    // ---- Ensure parent dir exists ----
    try {
        await fs.mkdir(path.dirname(MAINT_FILE), { recursive: true });
    } catch {
        // ignore
    }

    let backupStorage: MaintJson["backup_storage"];
    try {
        backupStorage = await loadBackupStorage(req);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unable to prepare backup storage";
        const status = typeof (err as { status?: unknown })?.status === "number"
            ? (err as { status: number }).status
            : 502;
        const res = NextResponse.json(
            { ok: false, error: "backup_storage_unavailable", message },
            { status }
        );
        if (status === 401) {
            res.cookies.delete("__gcub_a");
            res.cookies.delete("gc_at");
            res.cookies.delete("__gcub_s");
        }
        return res;
    }

    const payload: MaintJson = {
        enabled: true,
        reason: reason || null,
        by,
        started_at: new Date().toISOString(),
        allow,
        backup_storage: backupStorage,
    };

    // ---- Write maintenance flag ----
    // The file can hold S3 credentials, so it is created 0600 from the start (not chmod-ed
    // afterwards), and written via rename so a reader never sees a half-written file
    // (an unparsable file would be read as "not in maintenance").
    const tmpFile = `${MAINT_FILE}.${process.pid}.tmp`;
    await fs.writeFile(tmpFile, JSON.stringify(payload, null, 2), { encoding: "utf8", mode: 0o600 });
    await fs.rename(tmpFile, MAINT_FILE);

    // ---- Respond; proxy.ts picks the new state up from the file ----
    const res = NextResponse.json(
        {
            ok: true,
            enabled: true,
            file: MAINT_FILE,
            allow,
            reason: payload.reason,
            by: payload.by,
            started_at: payload.started_at,
        },
        { status: 200, headers: { "Cache-Control": "no-store" } }
    );

    // No maintenance cookie any more: proxy.ts reads the flag file directly, so the
    // state can't outlive maintenance in a browser that missed the exit.
    invalidateMaintenanceCache();

    return res;
}
