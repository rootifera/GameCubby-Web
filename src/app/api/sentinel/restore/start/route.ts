// src/app/api/sentinel/restore/start/route.ts
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import {
    getJob,
    setJob,
    updateJob,
    clearJob,
    isBusy,
    type CurrentJob,
    type JobPhase,
} from "../../_state";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const COOKIE_NAME = "__gcub_a";

const DEFAULT_MAINT_PATH = "/storage/maintenance.json";
const MAINT_FILE = process.env.GC_MAINT_FILE || DEFAULT_MAINT_PATH;

// Directories for dumps/logs (must be writable by the container)
const BACKUPS_DIR = process.env.GC_BACKUPS_DIR || "/storage/backups";
const LOGS_DIR = path.join(BACKUPS_DIR, "logs");
const PRERESTORE_DIR = path.join(BACKUPS_DIR, "prerestore");

// DB config (from environment)
const DB_HOST = process.env.DB_HOST || "gamecubby-db";
const DB_PORT = String(process.env.DB_PORT || "5432");
const DB_NAME = process.env.DB_NAME || "gamecubby";
const APP_DB_USER = process.env.DB_USER || "gamecubby";
const APP_DB_PASSWORD = process.env.DB_PASSWORD || ""; // never log

const MAINT_USER = process.env.MAINT_DB_USER || "postgres";
const MAINT_PASSWORD = process.env.MAINT_DB_PASSWORD || ""; // never log

function nowIso() {
    return new Date().toISOString();
}

async function ensureDirs() {
    await fs.mkdir(LOGS_DIR, { recursive: true });
    await fs.mkdir(PRERESTORE_DIR, { recursive: true });
}

/** Append a line to the job log. */
async function logLine(jobLog: string, line: string) {
    await fs.appendFile(jobLog, line.endsWith("\n") ? line : line + "\n", "utf8");
}

/** Spawn a command and stream its output to the log. Resolves with exit code. */
function runCmd(
    jobLog: string,
    cmd: string,
    args: string[],
    env: Record<string, string>
): Promise<number> {
    return new Promise((resolve) => {
        const child = spawn(cmd, args, { env: { ...process.env, ...env } });
        child.stdout.on("data", (d) => {
            logLine(jobLog, `[${cmd}] ${d.toString()}`).catch(() => {});
        });
        child.stderr.on("data", (d) => {
            logLine(jobLog, `[${cmd} ERR] ${d.toString()}`).catch(() => {});
        });
        child.on("close", (code) => resolve(code ?? 0));
    });
}

async function readMaintenanceEnabled(): Promise<boolean> {
    try {
        const raw = await fs.readFile(MAINT_FILE, "utf8");
        const j = JSON.parse(raw) as { enabled?: boolean };
        return !!j?.enabled;
    } catch {
        return false;
    }
}

function isPathUnder(dir: string, candidate: string) {
    const a = path.resolve(dir) + path.sep;
    const b = path.resolve(candidate);
    return b.startsWith(a);
}

export async function POST(req: NextRequest) {
    // ----- Admin auth (same cookie as /admin) -----
    const token = req.cookies.get(COOKIE_NAME)?.value ?? "";
    if (!token) {
        return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    // ----- Require maintenance to be ON before starting -----
    const maintOn = await readMaintenanceEnabled();
    if (!maintOn) {
        return NextResponse.json(
            { ok: false, error: "maintenance_off", message: "Enable maintenance mode first." },
            { status: 409 }
        );
    }

    // ----- Only one job at a time -----
    if (isBusy()) {
        const existing = getJob();
        return NextResponse.json(
            { ok: false, error: "busy", job_id: existing?.id, log_file: existing?.log_file },
            { status: 409 }
        );
    }

    // ----- Parse request -----
    type Body = { dump_path?: string; pre_dump?: boolean };
    let body: Body = {};
    try {
        if (req.headers.get("content-type")?.includes("application/json")) {
            body = (await req.json()) as Body;
        }
    } catch {
        // ignore
    }

    const dumpPath = (body.dump_path || "").trim();
    if (!dumpPath) {
        return NextResponse.json({ ok: false, error: "missing_dump_path" }, { status: 400 });
    }

    // Ensure the dump path exists and is under BACKUPS_DIR (safety)
    const resolvedDump = path.resolve(dumpPath);
    if (!isPathUnder(BACKUPS_DIR, resolvedDump)) {
        return NextResponse.json(
            { ok: false, error: "invalid_path", message: "dump_path must be under backups directory" },
            { status: 400 }
        );
    }
    try {
        const st = await fs.stat(resolvedDump);
        if (!st.isFile()) {
            return NextResponse.json({ ok: false, error: "not_a_file" }, { status: 400 });
        }
    } catch {
        return NextResponse.json({ ok: false, error: "file_not_found" }, { status: 404 });
    }

    await ensureDirs();

    // ----- Initialize job -----
    const jobId = crypto.randomUUID();
    const stamp = new Date()
        .toISOString()
        .replace(/[:-]/g, "")
        .replace(/\..+$/, "")
        .replace("T", "_");
    const logFile = path.join(LOGS_DIR, `restore_${stamp}.log`);
    await fs.writeFile(logFile, `# Restore job ${jobId} started ${nowIso()}\n`, "utf8");

    const job: CurrentJob = {
        id: jobId,
        kind: "restore",
        started_at: nowIso(),
        status: "running",
        phase: "init",
        log_file: logFile,
        dump_path: resolvedDump,
    };
    setJob(job);

    // ----- Fire-and-forget background job -----
    (async () => {
        const PRE = { PGPASSWORD: MAINT_PASSWORD };
        const PRE_APP = { PGPASSWORD: APP_DB_PASSWORD };

        const setPhase = (p: JobPhase) => updateJob({ phase: p });

        try {
            await logLine(logFile, `DB target: ${DB_HOST}:${DB_PORT} db=${DB_NAME}`);
            await logLine(logFile, `Dump: ${resolvedDump}`);

            // 1) Lock out app role
            setPhase("lock_app_user");
            await logLine(logFile, "== ALTER ROLE <app_user> NOLOGIN ==");
            {
                const sql = `ALTER ROLE "${APP_DB_USER}" NOLOGIN;`;
                const code = await runCmd(
                    logFile,
                    "psql",
                    ["-h", DB_HOST, "-p", DB_PORT, "-U", MAINT_USER, "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", sql],
                    PRE
                );
                if (code !== 0) throw new Error(`Failed to ALTER ROLE NOLOGIN (exit ${code})`);
            }

            // 2) Terminate sessions
            setPhase("terminate_sessions");
            await logLine(logFile, "== Terminating existing sessions ==");
            {
                const sql = `
          SELECT pg_terminate_backend(pid)
          FROM pg_stat_activity
          WHERE datname = '${DB_NAME}'
            AND pid <> pg_backend_pid();
        `;
                const code = await runCmd(
                    logFile,
                    "psql",
                    ["-h", DB_HOST, "-p", DB_PORT, "-U", MAINT_USER, "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", sql],
                    PRE
                );
                if (code !== 0) throw new Error(`Failed to terminate sessions (exit ${code})`);
            }

            // 3) Optional pre-restore snapshot
            if (body.pre_dump) {
                setPhase("pre_dump");
                const preFile = path.join(PRERESTORE_DIR, `prerestore_${DB_NAME}_${stamp}.dump`);
                updateJob({ pre_dump_file: preFile });
                await logLine(logFile, `== Pre-restore snapshot -> ${preFile} ==`);
                const code = await runCmd(
                    logFile,
                    "pg_dump",
                    ["-h", DB_HOST, "-p", DB_PORT, "-U", MAINT_USER, "-d", DB_NAME, "-Fc", "-f", preFile],
                    PRE
                );
                if (code !== 0) throw new Error(`Pre-restore dump failed (exit ${code})`);
            }

            // 4) Try database-level restore with --create
            setPhase("restore_create");
            await logLine(logFile, "== pg_restore (database-level, --create) ==");
            let code = await runCmd(
                logFile,
                "pg_restore",
                [
                    "--clean",
                    "--if-exists",
                    "--create",
                    "--no-owner",
                    "--no-privileges",
                    "-h",
                    DB_HOST,
                    "-p",
                    DB_PORT,
                    "-U",
                    MAINT_USER,
                    "-d",
                    "postgres",
                    resolvedDump,
                ],
                PRE
            );

            // 5) Fallback: in-place restore
            if (code !== 0) {
                await logLine(logFile, `pg_restore --create failed (exit ${code}), trying in-place restore...`);

                // 5a) Ensure DB exists
                setPhase("restore_inplace_prepare");
                const ensureDbSql = `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname='${DB_NAME}') THEN
    EXECUTE 'CREATE DATABASE "${DB_NAME}"';
  END IF;
END
$$;`;
                code = await runCmd(
                    logFile,
                    "psql",
                    ["-h", DB_HOST, "-p", DB_PORT, "-U", MAINT_USER, "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", ensureDbSql],
                    PRE
                );
                if (code !== 0) throw new Error(`Failed to ensure DB exists (exit ${code})`);

                // 5b) Reset schema
                const resetSql = `DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;`;
                code = await runCmd(
                    logFile,
                    "psql",
                    ["-h", DB_HOST, "-p", DB_PORT, "-U", MAINT_USER, "-d", DB_NAME, "-v", "ON_ERROR_STOP=1", "-c", resetSql],
                    PRE
                );
                if (code !== 0) throw new Error(`Failed to reset schema (exit ${code})`);

                // 5c) Restore into DB
                setPhase("restore_inplace");
                code = await runCmd(
                    logFile,
                    "pg_restore",
                    [
                        "--clean",
                        "--if-exists",
                        "--no-owner",
                        "--no-privileges",
                        "-h",
                        DB_HOST,
                        "-p",
                        DB_PORT,
                        "-U",
                        MAINT_USER,
                        "-d",
                        DB_NAME,
                        resolvedDump,
                    ],
                    PRE
                );
                if (code !== 0) throw new Error(`In-place pg_restore failed (exit ${code})`);
            }

            // 6) Analyze
            setPhase("analyze");
            await logLine(logFile, "== vacuumdb --analyze-in-stages ==");
            code = await runCmd(
                logFile,
                "vacuumdb",
                ["-h", DB_HOST, "-p", DB_PORT, "-U", MAINT_USER, "-d", DB_NAME, "--analyze-in-stages"],
                PRE
            );
            if (code !== 0) {
                await logLine(logFile, `vacuumdb returned non-zero exit ${code} (continuing).`);
            }

            // 7) Re-enable app user
            setPhase("reenable_app_user");
            await logLine(logFile, "== ALTER ROLE <app_user> LOGIN ==");
            {
                const sql = `ALTER ROLE "${APP_DB_USER}" LOGIN;`;
                const code2 = await runCmd(
                    logFile,
                    "psql",
                    ["-h", DB_HOST, "-p", DB_PORT, "-U", MAINT_USER, "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", sql],
                    PRE
                );
                if (code2 !== 0) throw new Error(`Failed to ALTER ROLE LOGIN (exit ${code2})`);
            }

            updateJob({ status: "succeeded", finished_at: nowIso(), phase: "done" });
            await logLine(logFile, `# SUCCESS ${nowIso()}`);
        } catch (err: any) {
            const msg = err?.message || String(err);
            updateJob({ status: "failed", error: msg, finished_at: nowIso() });
            await logLine(getJob()!.log_file, `# ERROR ${nowIso()} :: ${msg}`);

            // Best-effort: try to re-enable the app user so you aren't locked out
            try {
                await logLine(getJob()!.log_file, "Best-effort: re-enable app user after failure");
                await runCmd(
                    getJob()!.log_file,
                    "psql",
                    [
                        "-h",
                        DB_HOST,
                        "-p",
                        DB_PORT,
                        "-U",
                        MAINT_USER,
                        "-d",
                        "postgres",
                        "-v",
                        "ON_ERROR_STOP=1",
                        "-c",
                        `ALTER ROLE "${APP_DB_USER}" LOGIN;`,
                    ],
                    { PGPASSWORD: MAINT_PASSWORD }
                );
            } catch {
                /* ignore */
            }
        }
    })().catch(() => {});

    const j = getJob()!;
    return NextResponse.json(
        {
            ok: true,
            job_id: j.id,
            status: j.status,
            phase: j.phase,
            log_file: path.basename(j.log_file),
            dump_path: j.dump_path,
            pre_dump: !!body.pre_dump,
            started_at: j.started_at,
        },
        { status: 202, headers: { "Cache-Control": "no-store" } }
    );
}
