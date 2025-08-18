// src/app/api/sentinel/_state.ts

// Shared in-memory state for the current maintenance job.
// All /api/sentinel/* routes should import and use this module
// so they see the same live status within the Next.js server process.

export type JobKind = "restore" | "backup";
export type JobStatus = "idle" | "running" | "succeeded" | "failed";

export type JobPhase =
// ---- restore phases ----
    | "init"
    | "lock_app_user"
    | "terminate_sessions"
    | "pre_dump"
    | "restore_create"
    | "restore_inplace_prepare"
    | "restore_inplace"
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

    // Backup-specific
    backup_file?: string;
    pruned?: number; // count of files pruned (if any)
};

// Module-level singleton (not exported directly)
let currentJob: CurrentJob | null = null;

/** Return the current job or null if none. */
export function getJob(): CurrentJob | null {
    return currentJob ? { ...currentJob } : null;
}

/** Set/replace the current job (e.g., when a job starts). */
export function setJob(job: CurrentJob): void {
    currentJob = { ...job };
}

/** Merge updates into the current job (no-op if none). */
export function updateJob(patch: Partial<CurrentJob>): void {
    if (!currentJob) return;
    currentJob = { ...currentJob, ...patch };
}

/** Clear the current job (e.g., after completion or cancellation). */
export function clearJob(): void {
    currentJob = null;
}

/** True if a job is currently running. */
export function isBusy(): boolean {
    return !!currentJob && currentJob.status === "running";
}
