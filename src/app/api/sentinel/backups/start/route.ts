// src/app/api/sentinel/backups/start/route.ts
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
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

const COOKIE_NAME = "__gcub_a";

// Directories (inside container; bind-mounted via compose)
const BACKUPS_DIR = process.env.GC_BACKUPS_DIR || "/storage/backups";
const LOGS_DIR = path.join(BACKUPS_DIR, "logs");

// DB config (from environment)
const DB_HOST = process.env.DB_HOST || "gamecubby-db";
const DB_PORT = String(process.env.DB_PORT || "5432");
const DB_NAME = process.env.DB_NAME || "gamecubby";

// Use maintenance/admin role for consistent permissions
const MAINT_USER = process.env.MAINT_DB_USER || "postgres";
const MAINT_PASSWORD = process.env.MAINT_DB_PASSWORD || "";

// Retention (days)
const RETENTION_DAYS = Number(process.env.BACKUP_RETENTION_DAYS || "14") || 0;

// Allowed extensions treated as backup artifacts (for prune)
const ALLOWED_EXT = new Set([
    ".dump",
    ".backup",
    ".pgc",
    ".pgdump",
    ".tar",
    ".pgcustom",
]);

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

function runCmd(
    logFile: string,
    cmd: string,
    args: string[],
    env: Record<string, string>
): Promise<number> {
    return new Promise((resolve) => {
        const child = spawn(cmd, args, { env: { ...process.env, ...env } });
        child.stdout.on("data", (d) => logLine(logFile, `[${cmd}] ${d.toString()}`).catch(() => {}));
        child.stderr.on("data", (d) => logLine(logFile, `[${cmd} ERR] ${d.toString()}`).catch(() => {}));
        child.on("close", (code) => resolve(code ?? 0));
    });
}

function fileAgeDays(mtimeMs: number): number {
    const ms = Date.now() - mtimeMs;
    return ms / (1000 * 60 * 60 * 24);
}

async function pruneOldBackups(root: string, logFile: string): Promise<number> {
    if (RETENTION_DAYS <= 0) {
        await logLine(logFile, `Prune: retention disabled (BACKUP_RETENTION_DAYS=${RETENTION_DAYS})`);
        return 0;
    }

    let pruned = 0;
    let entries: any[] = [];
    try {
        entries = await fs.readdir(root, { withFileTypes: true });
    } catch {
        return 0;
    }

    for (const ent of entries) {
        // Skip our subdirs
        if (ent.isDirectory()) continue;
        const full = path.join(root, ent.name);
        const ext = path.extname(full).toLowerCase();
        if (!ALLOWED_EXT.has(ext)) continue;

        try {
            const st = await fs.stat(full);
            if (!st.isFile()) continue;
            const age = fileAgeDays(st.mtimeMs);
            if (age > RETENTION_DAYS) {
                await fs.unlink(full);
                pruned += 1;
                await logLine(logFile, `Prune: removed ${ent.name} (age ${age.toFixed(1)}d)`);
            }
        } catch {
            // ignore file-level errors
        }
    }
    return pruned;
}

export async function POST(req: NextRequest) {
    // ----- Admin auth -----
    const token = req.cookies.get(COOKIE_NAME)?.value ?? "";
    if (!token) {
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

    // ----- Parse options (optional) -----
    type Body = {
        label?: string;        // optional suffix in filename
        schema_only?: boolean; // rarely needed; defaults to false
    };
    let body: Body = {};
    try {
        if (req.headers.get("content-type")?.includes("application/json")) {
            body = (await req.json()) as Body;
        }
    } catch {
        // ignore bad body
    }

    const labelSafe = (body.label || "").replace(/[^a-zA-Z0-9._-]+/g, "").slice(0, 40);
    const stamp = new Date().toISOString().replace(/[:-]/g, "").replace(/\..+$/, "").replace("T", "_");
    const baseName = `backup_${DB_NAME}_${stamp}${labelSafe ? "_" + labelSafe : ""}.dump`;
    const backupFile = path.join(BACKUPS_DIR, baseName);
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
        backup_file: backupFile,
    };
    setJob(job);

    // ----- Fire-and-forget background backup job -----
    (async () => {
        try {
            await logLine(logFile, `DB target: ${DB_HOST}:${DB_PORT} db=${DB_NAME}`);
            await logLine(logFile, `Output: ${backupFile}`);
            await logLine(logFile, `Retention: ${RETENTION_DAYS} days`);

            // 1) pg_dump (custom format)
            updateJob({ phase: "backup_dump" });
            const args = [
                "-h", DB_HOST,
                "-p", DB_PORT,
                "-U", MAINT_USER,
                "-d", DB_NAME,
                "-Fc",
                "-f", backupFile,
            ];
            if (body.schema_only) args.push("--schema-only");

            const code = await runCmd(logFile, "pg_dump", args, { PGPASSWORD: MAINT_PASSWORD });
            if (code !== 0) {
                throw new Error(`pg_dump failed (exit ${code})`);
            }

            // 2) Prune older files
            updateJob({ phase: "backup_prune" });
            const pruned = await pruneOldBackups(BACKUPS_DIR, logFile);
            updateJob({ pruned });

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
            backup_file: backupFile,
            started_at: job.started_at,
        },
        { status: 202, headers: { "Cache-Control": "no-store" } }
    );
}
