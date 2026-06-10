// src/app/api/sentinel/backups/start/route.ts
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { hasActiveTokenFromRequest, readTokenFromRequest } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/env";
import {
    getJob,
    setJob,
    updateJob,
    isBusy,
    type CurrentJob,
} from "../../_state";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

// Directories (inside container; bind-mounted via compose)
const BACKUPS_DIR = process.env.GC_BACKUPS_DIR || "/storage/backups";
const LOGS_DIR = path.join(BACKUPS_DIR, "logs");

function nowIso() {
    return new Date().toISOString();
}

async function ensureDirs() {
    await fs.mkdir(BACKUPS_DIR, { recursive: true });
    await fs.mkdir(LOGS_DIR, { recursive: true });
}

async function logLine(logFile: string, line: string) {
    await fs.appendFile(logFile, (line.endsWith("\n") ? line : line + "\n"), "utf8");
}

export async function POST(req: NextRequest) {
    // ----- Admin auth -----
    if (!hasActiveTokenFromRequest(req)) {
        return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    // ----- Prevent parallel jobs -----
    if (isBusy()) {
        const j = getJob();
        return NextResponse.json(
            { ok: false, error: "busy", job_id: j?.id, kind: j?.kind, status: j?.status },
            { status: 409 }
        );
    }

    const stamp = new Date().toISOString().replace(/[:-]/g, "").replace(/\..+$/, "").replace("T", "_");
    const logFile = path.join(LOGS_DIR, `backup_${stamp}.log`);

    await ensureDirs();
    await fs.writeFile(logFile, `# Backup started ${nowIso()}\n`, "utf8");

    // ----- Initialize job -----
    const jobId = crypto.randomUUID();
    const job: CurrentJob = {
        id: jobId,
        kind: "backup",
        started_at: nowIso(),
        status: "running",
        phase: "backup_init",
        log_file: logFile,
        backup_file: undefined,
    };
    setJob(job);
    const token = readTokenFromRequest(req);

    // ----- Fire-and-forget background backup job -----
    (async () => {
        try {
            await logLine(logFile, `API backup target: ${API_BASE_URL}/backup/save`);
            updateJob({ phase: "backup_dump" });
            const res = await fetch(`${API_BASE_URL}/backup/save`, {
                method: "POST",
                cache: "no-store",
                headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${token}`,
                },
            });
            const text = await res.text();
            if (!res.ok) {
                throw new Error(`API backup failed (${res.status}) ${text}`);
            }
            const data = text ? JSON.parse(text) as {
                saved_path?: string;
                saved_bytes?: number;
                deleted?: string[];
            } : {};
            updateJob({
                phase: "backup_done",
                backup_file: data.saved_path,
                pruned: Array.isArray(data.deleted) ? data.deleted.length : 0,
            });
            await logLine(logFile, `Saved: ${data.saved_path || "unknown"}`);
            await logLine(logFile, `Bytes: ${data.saved_bytes ?? 0}`);

            // Done
            updateJob({ phase: "backup_done", status: "succeeded", finished_at: nowIso() });
            await logLine(logFile, `# SUCCESS ${nowIso()}`);
        } catch (err: any) {
            const msg = err?.message || String(err);
            updateJob({ status: "failed", error: msg, finished_at: nowIso() });
            await logLine(logFile, `# ERROR ${nowIso()} :: ${msg}`);
        }
    })().catch(() => {});

    return NextResponse.json(
        {
            ok: true,
            job_id: jobId,
            kind: "backup",
            status: "running",
            phase: "backup_init",
            backup_file: undefined,
            started_at: job.started_at,
        },
        { status: 202, headers: { "Cache-Control": "no-store" } }
    );
}
