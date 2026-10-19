// src/app/api/sentinel/restore/start/route.ts
import { NextRequest, NextResponse } from "next/server";
import { promises as fs, createReadStream } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import { hasActiveTokenFromRequest } from "@/lib/auth";
import {
    backupPrefix,
    getS3BackupObject,
    parseS3Uri,
    readS3BackupConfig,
    uploadS3Backup,
    type S3BackupConfig,
} from "@/lib/s3Backup";
import {
    getJob,
    updateJob,
    clearJob,
    tryStartJob,
    type CurrentJob,
    type JobPhase,
} from "../../_state";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const DEFAULT_MAINT_PATH = "/storage/maintenance.json";
const MAINT_FILE = process.env.GC_MAINT_FILE || DEFAULT_MAINT_PATH;

// Directories for dumps/logs (must be writable by the container)
const BACKUPS_DIR = process.env.GC_BACKUPS_DIR || "/storage/backups";
// Same folder the backup logs (and the API's log pruning) use, on the persistent
// /storage volume -- /tmp would lose every restore log when the container is recreated.
const LOGS_DIR = process.env.GC_LOGS_DIR || path.join(/* turbopackIgnore: true */ BACKUPS_DIR, "logs");
const PRERESTORE_DIR = path.join(/* turbopackIgnore: true */ BACKUPS_DIR, "prerestore");

// DB config (from environment)
const DB_HOST = process.env.DB_HOST || "gamecubby-db";
const DB_PORT = String(process.env.DB_PORT || "5432");
const DB_NAME = process.env.DB_NAME || "gamecubby";
const APP_DB_USER = process.env.DB_USER || "gamecubby";
const APP_DB_PASSWORD = process.env.DB_PASSWORD || ""; // never log

const MAINT_USER = process.env.MAINT_DB_USER || "postgres";
const MAINT_PASSWORD = process.env.MAINT_DB_PASSWORD || ""; // never log

const CHECKSUM_SUFFIX = ".sha256";

function nowIso() {
    return new Date().toISOString();
}

async function ensureDirs(usingS3: boolean) {
    await fs.mkdir(LOGS_DIR, { recursive: true });
    if (!usingS3) await fs.mkdir(PRERESTORE_DIR, { recursive: true });
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
    env: Record<string, string>,
    input?: NodeJS.ReadableStream
): Promise<number> {
    return new Promise((resolve) => {
        let settled = false;
        const finish = (code: number) => {
            if (settled) return;
            settled = true;
            resolve(code);
        };
        const child = spawn(cmd, args, { env: { ...process.env, ...env } });
        child.stdout.on("data", (d) => {
            logLine(jobLog, `[${cmd}] ${d.toString()}`).catch(() => {});
        });
        child.stderr.on("data", (d) => {
            logLine(jobLog, `[${cmd} ERR] ${d.toString()}`).catch(() => {});
        });
        // Without these, an early child exit (EPIPE) or a failing input stream
        // (e.g. an S3 error mid-download) raises an unhandled 'error' event and
        // takes the whole Next.js server down.
        child.stdin.on("error", () => {});
        if (input) {
            input.on("error", (err: Error) => {
                logLine(jobLog, `[${cmd} ERR] input stream failed: ${err.message}`).catch(() => {});
                child.kill();
            });
            input.pipe(child.stdin);
        }
        child.on("error", (err) => {
            logLine(jobLog, `[${cmd} ERR] Failed to start: ${err.message}`).catch(() => {});
            finish(127);
        });
        child.on("close", (code) => finish(code ?? 1));
    });
}

/**
 * Run a command without logging stdout (e.g. `pg_restore --list` prints the whole
 * table of contents). Resolves with the exit code and a tail of stderr.
 */
function runCmdQuiet(
    cmd: string,
    args: string[],
    env: Record<string, string>,
    input?: NodeJS.ReadableStream
): Promise<{ code: number; stderr: string }> {
    return new Promise((resolve) => {
        let settled = false;
        let stderr = "";
        const finish = (code: number) => {
            if (settled) return;
            settled = true;
            resolve({ code, stderr: stderr.trim().slice(-2000) });
        };
        const child = spawn(cmd, args, { env: { ...process.env, ...env } });
        child.stdout.resume();
        child.stderr.on("data", (d) => {
            stderr += d.toString();
        });
        // pg_restore may exit before consuming all input; that surfaces as EPIPE.
        child.stdin.on("error", () => {});
        if (input) {
            input.on("error", (err: Error) => {
                stderr += `input stream error: ${err.message}\n`;
                child.kill();
            });
            input.pipe(child.stdin);
        } else {
            child.stdin.end();
        }
        child.on("error", (err) => {
            stderr += `Failed to start: ${err.message}`;
            finish(127);
        });
        child.on("close", (code) => finish(code ?? 1));
    });
}

async function runPgDumpToS3(
    jobLog: string,
    args: string[],
    env: Record<string, string>,
    config: S3BackupConfig,
    key: string
): Promise<{ code: number; uri: string }> {
    const child = spawn("pg_dump", args, { env: { ...process.env, ...env } });
    child.stderr.on("data", (data) => {
        logLine(jobLog, `[pg_dump ERR] ${data.toString()}`).catch(() => {});
    });
    child.stdout.on("error", () => {});
    const close = new Promise<number>((resolve) => {
        child.on("error", (err) => {
            logLine(jobLog, `[pg_dump ERR] Failed to start: ${err.message}`).catch(() => {});
            resolve(127);
        });
        child.on("close", (code) => resolve(code ?? 1));
    });
    const upload = uploadS3Backup(config, key, child.stdout).catch((err: Error) => {
        // Upload died: stop pg_dump instead of leaving it blocked on a full pipe.
        logLine(jobLog, `[s3 ERR] upload failed: ${err.message}`).catch(() => {});
        child.kill();
        return null;
    });
    const [code, uri] = await Promise.all([close, upload]);
    if (uri === null) return { code: code || 1, uri: "" };
    return { code, uri };
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
    const a = path.resolve(/* turbopackIgnore: true */ dir) + path.sep;
    const b = path.resolve(/* turbopackIgnore: true */ candidate);
    return b.startsWith(a);
}

function sha256OfStream(stream: NodeJS.ReadableStream): Promise<string> {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash("sha256");
        stream.on("data", (chunk) => hash.update(chunk));
        stream.on("end", () => resolve(hash.digest("hex")));
        stream.on("error", reject);
    });
}

function isNotFound(err: unknown): boolean {
    const e = err as { code?: string; name?: string; $metadata?: { httpStatusCode?: number } };
    return e?.code === "ENOENT" || e?.name === "NoSuchKey" || e?.$metadata?.httpStatusCode === 404;
}

/**
 * Read the `<dump>.sha256` sidecar written at backup time.
 * Returns null if there is none (older backups); throws on a malformed sidecar
 * or on any read error other than "not found".
 */
async function readExpectedSha256(ref: string, s3Config: S3BackupConfig | null): Promise<string | null> {
    let text: string;
    try {
        if (s3Config) {
            const obj = await getS3BackupObject(s3Config, ref + CHECKSUM_SUFFIX);
            text = await (obj.Body as { transformToString(): Promise<string> }).transformToString();
        } else {
            text = await fs.readFile(ref + CHECKSUM_SUFFIX, "utf8");
        }
    } catch (err) {
        if (isNotFound(err)) return null;
        throw err;
    }
    const m = /^([a-f0-9]{64})\b/i.exec(text.trim());
    if (!m) throw new Error(`Checksum file ${ref}${CHECKSUM_SUFFIX} is malformed.`);
    return m[1].toLowerCase();
}

async function openDump(ref: string, s3Config: S3BackupConfig | null): Promise<NodeJS.ReadableStream> {
    if (!s3Config) return createReadStream(ref);
    const object = await getS3BackupObject(s3Config, ref);
    if (!object.Body) throw new Error("S3 returned an empty backup object");
    return object.Body as NodeJS.ReadableStream;
}

/**
 * Check a dump BEFORE anything destructive happens:
 *  1) if a checksum was recorded at backup time, the file must match it
 *     (catches truncation and bit-rot anywhere in the file);
 *  2) it must be a readable pg_dump archive (`pg_restore --list`).
 */
async function validateDump(
    jobLog: string,
    ref: string,
    s3Config: S3BackupConfig | null,
    opts: { warnIfNoChecksum: boolean }
): Promise<void> {
    const expected = await readExpectedSha256(ref, s3Config);
    if (expected) {
        await logLine(jobLog, "== Verifying SHA-256 checksum ==");
        const actual = await sha256OfStream(await openDump(ref, s3Config));
        if (actual !== expected) {
            throw new Error(
                `Checksum mismatch for ${path.basename(ref)} (expected ${expected}, got ${actual}); ` +
                `the backup is corrupt or was modified. Database contents were not modified.`
            );
        }
        await logLine(jobLog, "Checksum OK.");
    } else if (opts.warnIfNoChecksum) {
        await logLine(jobLog, "WARNING: no checksum recorded for this backup (created before checksums); skipping integrity check.");
    }

    await logLine(jobLog, "== Validating dump (pg_restore --list) ==");
    const check = s3Config
        ? await runCmdQuiet("pg_restore", ["--list"], {}, await openDump(ref, s3Config))
        : await runCmdQuiet("pg_restore", ["--list", ref], {});
    if (check.code !== 0) {
        if (check.stderr) await logLine(jobLog, `[pg_restore ERR] ${check.stderr}`);
        throw new Error(
            `Dump validation failed (exit ${check.code}); the file is not a readable backup. Database contents were not modified.`
        );
    }
    await logLine(jobLog, "Dump is readable.");
}

async function startRestore(req: NextRequest) {
    // ----- Admin auth (same cookie as /admin) -----
    if (!hasActiveTokenFromRequest(req)) {
        return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    // ----- Only one job at a time -----
    // Claim the slot synchronously, before any await, so two quick requests can't
    // both pass the check. Every early return below releases it (see `finally`).
    const jobId = crypto.randomUUID();
    const reserved: CurrentJob = {
        id: jobId,
        kind: "restore",
        started_at: nowIso(),
        status: "running",
        phase: "init",
        log_file: "",
    };
    if (!tryStartJob(reserved)) {
        const existing = getJob();
        return NextResponse.json(
            { ok: false, error: "busy", job_id: existing?.id, log_file: existing?.log_file },
            { status: 409 }
        );
    }

    let launched = false;
    try {
        // ----- Require maintenance to be ON before starting -----
        const maintOn = await readMaintenanceEnabled();
        if (!maintOn) {
            return NextResponse.json(
                { ok: false, error: "maintenance_off", message: "Enable maintenance mode first." },
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
        // The pre-restore snapshot is what makes automatic rollback possible, so it
        // is on unless the caller explicitly opts out.
        const wantPreDump = body.pre_dump !== false;

        const requestedDump = (body.dump_path || "").trim();
        if (!requestedDump) {
            return NextResponse.json({ ok: false, error: "missing_dump_path" }, { status: 400 });
        }

        const selectedS3 = parseS3Uri(requestedDump);
        const s3Config = selectedS3 ? await readS3BackupConfig() : null;
        let resolvedDump = requestedDump;

        if (selectedS3) {
            if (!s3Config || selectedS3.bucket !== s3Config.bucket) {
                return NextResponse.json(
                    { ok: false, error: "invalid_s3_backup", message: "S3 backup configuration is unavailable." },
                    { status: 400 }
                );
            }
        } else {
            // Relative local paths are resolved beneath BACKUPS_DIR and contained there.
            resolvedDump = path.isAbsolute(requestedDump)
                ? path.resolve(/* turbopackIgnore: true */ requestedDump)
                : path.resolve(/* turbopackIgnore: true */ BACKUPS_DIR, requestedDump);
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
        }

        await ensureDirs(!!s3Config);

        // ----- Initialize job log -----
        const stamp = new Date()
            .toISOString()
            .replace(/[:-]/g, "")
            .replace(/\..+$/, "")
            .replace("T", "_");
        const logFile = path.join(/* turbopackIgnore: true */ LOGS_DIR, `restore_${stamp}.log`);
        await fs.writeFile(logFile, `# Restore job ${jobId} started ${nowIso()}\n`, "utf8");
        updateJob({ log_file: logFile, dump_path: resolvedDump });

        launched = true;

        // ----- Fire-and-forget background job -----
        (async () => {
            const PRE = { PGPASSWORD: MAINT_PASSWORD };

            const setPhase = (p: JobPhase) => updateJob({ phase: p });
            const psql = (db: string, sql: string) =>
                runCmd(
                    logFile,
                    "psql",
                    ["-h", DB_HOST, "-p", DB_PORT, "-U", MAINT_USER, "-d", db, "-v", "ON_ERROR_STOP=1", "-c", sql],
                    PRE
                );

            /**
             * Restore `ref` (local path or s3:// URI) over the live database:
             * database-level restore first, in-place restore as fallback.
             * Throws if both fail. Destructive.
             */
            const restoreDatabase = async (ref: string) => {
                const fromS3 = !!s3Config && ref.startsWith("s3://");
                const runPgRestore = async (args: string[]) => {
                    if (!fromS3) return runCmd(logFile, "pg_restore", [...args, ref], PRE);
                    return runCmd(logFile, "pg_restore", args, PRE, await openDump(ref, s3Config));
                };

                // Database-level restore with --create
                setPhase("restore_create");
                await logLine(logFile, "== pg_restore (database-level, --create) ==");
                let code = await runPgRestore([
                    "--clean", "--if-exists", "--create", "--no-owner", "--no-privileges",
                    "-h", DB_HOST, "-p", DB_PORT, "-U", MAINT_USER, "-d", "postgres",
                ]);
                if (code === 0) return;

                // Fallback: in-place restore
                await logLine(logFile, `pg_restore --create failed (exit ${code}), trying in-place restore...`);

                setPhase("restore_inplace_prepare");
                code = await psql(
                    "postgres",
                    `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname='${DB_NAME}') THEN
    EXECUTE 'CREATE DATABASE "${DB_NAME}"';
  END IF;
END
$$;`
                );
                if (code !== 0) throw new Error(`Failed to ensure DB exists (exit ${code})`);

                code = await psql(DB_NAME, `DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;`);
                if (code !== 0) throw new Error(`Failed to reset schema (exit ${code})`);

                setPhase("restore_inplace");
                code = await runPgRestore([
                    "--clean", "--if-exists", "--no-owner", "--no-privileges",
                    "-h", DB_HOST, "-p", DB_PORT, "-U", MAINT_USER, "-d", DB_NAME,
                ]);
                if (code !== 0) throw new Error(`In-place pg_restore failed (exit ${code})`);
            };

            // Set once the live database may have been modified; from then on a
            // failure needs a rollback rather than just re-enabling the app.
            let destructiveStarted = false;
            let preDumpFile: string | null = null;

            try {
                await logLine(logFile, `DB target: ${DB_HOST}:${DB_PORT} db=${DB_NAME}`);
                await logLine(logFile, `Dump: ${resolvedDump}`);

                // 0) Preflight: verify the dump BEFORE touching the database.
                setPhase("validate_dump");
                await validateDump(logFile, resolvedDump, s3Config, { warnIfNoChecksum: true });

                // 1) Lock out app role
                setPhase("lock_app_user");
                await logLine(logFile, "== ALTER ROLE <app_user> NOLOGIN ==");
                {
                    const code = await psql("postgres", `ALTER ROLE "${APP_DB_USER}" NOLOGIN;`);
                    if (code !== 0) throw new Error(`Failed to ALTER ROLE NOLOGIN (exit ${code})`);
                }

                // 2) Terminate sessions
                setPhase("terminate_sessions");
                await logLine(logFile, "== Terminating existing sessions ==");
                {
                    const code = await psql(
                        "postgres",
                        `
          SELECT pg_terminate_backend(pid)
          FROM pg_stat_activity
          WHERE datname = '${DB_NAME}'
            AND pid <> pg_backend_pid();
        `
                    );
                    if (code !== 0) throw new Error(`Failed to terminate sessions (exit ${code})`);
                }

                // 3) Pre-restore snapshot (the rollback point)
                if (wantPreDump) {
                    setPhase("pre_dump");
                    const preName = `prerestore_${DB_NAME}_${stamp}.dump`;
                    const preFile = s3Config
                        ? `s3://${s3Config.bucket}/${backupPrefix(s3Config)}prerestore/${preName}`
                        : path.join(/* turbopackIgnore: true */ PRERESTORE_DIR, preName);
                    updateJob({ pre_dump_file: preFile });
                    await logLine(logFile, `== Pre-restore snapshot -> ${preFile} ==`);
                    const code = s3Config
                        ? (await runPgDumpToS3(
                            logFile,
                            ["-h", DB_HOST, "-p", DB_PORT, "-U", MAINT_USER, "-d", DB_NAME, "-Fc"],
                            PRE,
                            s3Config,
                            `${backupPrefix(s3Config)}prerestore/${preName}`
                        )).code
                        : await runCmd(
                            logFile,
                            "pg_dump",
                            ["-h", DB_HOST, "-p", DB_PORT, "-U", MAINT_USER, "-d", DB_NAME, "-Fc", "-f", preFile],
                            PRE
                        );
                    if (code !== 0) throw new Error(`Pre-restore dump failed (exit ${code})`);
                    // Make sure the rollback point is actually usable before relying on it.
                    await validateDump(logFile, preFile, s3Config, { warnIfNoChecksum: false });
                    preDumpFile = preFile;
                } else {
                    await logLine(logFile, "WARNING: pre-restore snapshot disabled; a failed restore cannot be rolled back.");
                }

                // 4) Restore (destructive from here on)
                destructiveStarted = true;
                await restoreDatabase(resolvedDump);

                // 5) Analyze
                setPhase("analyze");
                await logLine(logFile, "== vacuumdb --analyze-in-stages ==");
                const vacCode = await runCmd(
                    logFile,
                    "vacuumdb",
                    ["-h", DB_HOST, "-p", DB_PORT, "-U", MAINT_USER, "-d", DB_NAME, "--analyze-in-stages"],
                    PRE
                );
                if (vacCode !== 0) {
                    await logLine(logFile, `vacuumdb returned non-zero exit ${vacCode} (continuing).`);
                }

                // 6) Re-enable app user
                setPhase("reenable_app_user");
                await logLine(logFile, "== ALTER ROLE <app_user> LOGIN ==");
                {
                    const code = await psql("postgres", `ALTER ROLE "${APP_DB_USER}" LOGIN;`);
                    if (code !== 0) throw new Error(`Failed to ALTER ROLE LOGIN (exit ${code})`);
                }

                updateJob({ status: "succeeded", finished_at: nowIso(), phase: "done" });
                await logLine(logFile, `# SUCCESS ${nowIso()}`);
            } catch (err: any) {
                let msg: string = err?.message || String(err);
                await logLine(logFile, `# ERROR ${nowIso()} :: ${msg}`).catch(() => {});

                // Roll back to the pre-restore snapshot if the live DB may be damaged.
                let rolledBack = false;
                if (destructiveStarted) {
                    if (preDumpFile) {
                        setPhase("rollback");
                        await logLine(logFile, `== ROLLBACK: restoring pre-restore snapshot ${preDumpFile} ==`).catch(() => {});
                        try {
                            await restoreDatabase(preDumpFile);
                            rolledBack = true;
                            updateJob({ rollback: "succeeded" });
                            msg += " The database was rolled back to its state before the restore.";
                            await logLine(logFile, "ROLLBACK SUCCEEDED").catch(() => {});
                        } catch (rbErr: any) {
                            updateJob({ rollback: "failed" });
                            msg +=
                                ` Automatic rollback ALSO failed (${rbErr?.message || rbErr}); the database may be in an inconsistent state` +
                                ` and the app's database login stays disabled. The pre-restore snapshot is at ${preDumpFile}.`;
                            await logLine(logFile, `ROLLBACK FAILED :: ${rbErr?.message || rbErr}`).catch(() => {});
                        }
                    } else {
                        updateJob({ rollback: "unavailable" });
                        msg += " No pre-restore snapshot was taken, so the database could not be rolled back.";
                    }
                }

                updateJob({ status: "failed", error: msg, finished_at: nowIso() });

                // Re-enable the app user so you aren't locked out, unless the DB is
                // known-broken (destructive step ran and neither restore nor rollback worked).
                const dbKnownBroken = destructiveStarted && !rolledBack;
                if (!dbKnownBroken) {
                    try {
                        await logLine(logFile, "Best-effort: re-enable app user after failure");
                        await psql("postgres", `ALTER ROLE "${APP_DB_USER}" LOGIN;`);
                    } catch {
                        /* ignore */
                    }
                } else {
                    await logLine(logFile, "App DB login left disabled: database state is unknown. Restore a known-good backup to recover.").catch(() => {});
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
                pre_dump: wantPreDump,
                started_at: j.started_at,
            },
            { status: 202, headers: { "Cache-Control": "no-store" } }
        );
    } finally {
        // Any early return or throw before the job actually launched frees the slot.
        if (!launched) clearJob();
    }
}

export async function POST(req: NextRequest) {
    try {
        return await startRestore(req);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown restore error";
        console.error("Failed to start database restore:", err);
        return NextResponse.json(
            { ok: false, error: "restore_start_failed", message },
            { status: 500, headers: { "Cache-Control": "no-store" } }
        );
    }
}
