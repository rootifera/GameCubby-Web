// src/app/api/sentinel/_state.ts

// Shared in-memory state for the current maintenance job.
// All /api/sentinel/* routes should import and use this module
// so they see the same live status within the Next.js server process.

export type JobKind = "restore" | "backup";
export type JobStatus = "idle" | "running" | "succeeded" | "failed";

export type JobPhase =
// ---- restore phases ----
    | "init"
    | "validate_dump"
    | "lock_app_user"
    | "terminate_sessions"
    | "pre_dump"
    | "restore_create"
    | "restore_inplace_prepare"
    | "restore_inplace"
    | "rollback"
    | "analyze"
    | "reenable_app_user"
    | "done"
    // ---- backup phases ----
    | "backup_init"
    | "backup_dump"
    | "backup_prune"
    | "backup_done";

export type CurrentJob = {
    id: string;
    kind: JobKind;
    started_at: string;
    finished_at?: string;
    status: JobStatus;
    phase: JobPhase;
    log_file: string;
    // Common fields
    error?: string;

    // Restore-specific
    dump_path?: string;
    pre_dump_file?: string;
    /** Outcome of the automatic rollback to the pre-restore snapshot, if a restore failed. */
    rollback?: "succeeded" | "failed" | "unavailable";

    // Backup-specific
    backup_file?: string;
    pruned?: number; // count of files pruned (if any)
};

// Process-wide singleton. Kept on globalThis because Next can bundle each route
// separately, which would otherwise give every route its own copy of the lock.
const globalStore = globalThis as typeof globalThis & { __gcSentinelJob?: { job: CurrentJob | null } };
const store = (globalStore.__gcSentinelJob ??= { job: null });

/** Return the current job or null if none. */
export function getJob(): CurrentJob | null {
    return store.job ? { ...store.job } : null;
}

/** Set/replace the current job (e.g., when a job starts). */
export function setJob(job: CurrentJob): void {
    store.job = { ...job };
}

/**
 * Atomically claim the single job slot. Synchronous on purpose: call it before
 * any `await` so two quick requests can't both pass the busy check.
 * Returns false (and changes nothing) if a job is already running.
 */
export function tryStartJob(job: CurrentJob): boolean {
    if (isBusy()) return false;
    store.job = { ...job };
    return true;
}

/** Merge updates into the current job (no-op if none). */
export function updateJob(patch: Partial<CurrentJob>): void {
    if (!store.job) return;
    store.job = { ...store.job, ...patch };
}

/** Clear the current job (e.g., after completion or cancellation). */
export function clearJob(): void {
    store.job = null;
}

/** True if a job is currently running. */
export function isBusy(): boolean {
    return !!store.job && store.job.status === "running";
}
