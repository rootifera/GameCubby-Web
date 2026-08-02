// src/app/api/sentinel/backups/list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { hasActiveTokenFromRequest, readTokenFromRequest } from "@/lib/auth";
import { isBackupName, listS3Backups, readS3BackupConfig } from "@/lib/s3Backup";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const BACKUPS_DIR = process.env.GC_BACKUPS_DIR || "/storage/backups";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://gamecubby-api:8000";
export async function GET(req: NextRequest) {
    if (!hasActiveTokenFromRequest(req)) {
        return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    try {
        const s3Config = await readS3BackupConfig();
        if (s3Config) {
            const files = await listS3Backups(s3Config);
            return NextResponse.json(
                { ok: true, storage: "s3", files },
                { status: 200, headers: { "Cache-Control": "no-store" } }
            );
        }

        // Outside maintenance, use the API's configured backend so the page
        // reflects S3 immediately after it is selected in settings.
        try {
            const authorization = `Bearer ${readTokenFromRequest(req)}`;
            const [configRes, listRes] = await Promise.all([
                fetch(`${API_BASE}/app_config/`, {
                    cache: "no-store",
                    headers: { Accept: "application/json", Authorization: authorization },
                }),
                fetch(`${API_BASE}/backup/list`, {
                    cache: "no-store",
                    headers: { Accept: "application/json", Authorization: authorization },
                }),
            ]);
            if (configRes.ok && listRes.ok) {
                const entries = await configRes.json() as Array<{ key?: string; value?: string }>;
                const backend = entries.find((entry) => entry.key === "backup_storage_backend")?.value || "local";
                const data = await listRes.json() as { files?: Array<{ source?: string }> };
                const files = Array.isArray(data.files)
                    ? data.files.filter((file) => (file.source || "local") === backend)
                    : [];
                return NextResponse.json(
                    { ok: true, storage: backend, files },
                    { status: 200, headers: { "Cache-Control": "no-store" } }
                );
            }
        } catch {
            // In local maintenance mode the API is intentionally unavailable.
        }

        await fs.mkdir(BACKUPS_DIR, { recursive: true });
        const entries = await fs.readdir(BACKUPS_DIR, { withFileTypes: true });
        const files = await Promise.all(
            entries
                .filter((entry) => entry.isFile() && isBackupName(entry.name))
                .map(async (entry) => {
                    const abspath = path.join(BACKUPS_DIR, entry.name);
                    const stat = await fs.stat(abspath);
                    return {
                        name: entry.name,
                        relpath: entry.name,
                        abspath,
                        size: stat.size,
                        mtime: stat.mtime.toISOString(),
                    };
                })
        );
        files.sort((a, b) => b.mtime.localeCompare(a.mtime));

        return NextResponse.json(
            { ok: true, files },
            { status: 200, headers: { "Cache-Control": "no-store" } }
        );
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unable to read backup directory";
        console.error("Failed to list database backups:", err);
        return NextResponse.json(
            { ok: false, error: "backup_list_failed", message },
            { status: 500, headers: { "Cache-Control": "no-store" } }
        );
    }
}
