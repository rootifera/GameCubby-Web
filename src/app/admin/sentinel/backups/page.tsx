"use client";

import React from "react";

type BackupFile = {
    name: string;
    relpath: string;
    abspath: string;
    size: number;
    mtime: string; // ISO
};

type StatusResp = {
    ok: boolean;
    status: "idle" | "running" | "succeeded" | "failed";
    phase?: string;
    job: null | {
        id: string;
        kind: "backup" | "restore";
        started_at: string;
        finished_at: string | null;
        log_file: string;
        backup_file?: string;   // backup
        pruned?: number;
        error: string | null;
    };
};

export default function BackupsPage() {
    const [backups, setBackups] = React.useState<BackupFile[]>([]);
    const [loading, setLoading] = React.useState(false);

    const [ensuring, setEnsuring] = React.useState(false);
    const [ensureMsg, setEnsureMsg] = React.useState<string | null>(null);

    const [starting, setStarting] = React.useState(false);

    const [jobStatus, setJobStatus] = React.useState<StatusResp | null>(null);
    const [polling, setPolling] = React.useState(false);
    const [logText, setLogText] = React.useState("");
    const [logOffset, setLogOffset] = React.useState(0);

    const [error, setError] = React.useState<string | null>(null);

    const fmtBytes = (n: number) => {
        if (n < 1024) return `${n} B`;
        if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
        if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
        return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    };
    const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleString() : "—");

    const loadBackups = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/sentinel/backups/list", { cache: "no-store" });
            const j = await res.json();
            const files: BackupFile[] = Array.isArray(j.files) ? j.files : [];
            setBackups(files);
        } catch (e: any) {
            setError(e?.message || "Failed to load backups");
        } finally {
            setLoading(false);
        }
    }, []);

    const loadStatusOnce = React.useCallback(async () => {
        try {
            const res = await fetch("/api/sentinel/restore/status", { cache: "no-store" });
            const j: StatusResp = await res.json();
            setJobStatus(j);
            if (j.status === "running") setPolling(true);
        } catch {
            /* ignore */
        }
    }, []);

    // Warm the POST route module (first request to a route in dev can compile it;
    // a harmless GET returns 405, but ensures the file is loaded before the real POST).
    const warmStartRoute = React.useCallback(async () => {
        try {
            await fetch("/api/sentinel/backups/start", { method: "GET", cache: "no-store" });
        } catch {
            /* ignore */
        }
    }, []);

    React.useEffect(() => {
        Promise.all([loadBackups(), loadStatusOnce(), warmStartRoute()]).catch(() => {});
    }, [loadBackups, loadStatusOnce, warmStartRoute]);

    // Poll job status + logs (unified endpoints)
    React.useEffect(() => {
        if (!polling) return;
        let cancelled = false;
        const tick = async () => {
            try {
                const sRes = await fetch("/api/sentinel/restore/status", { cache: "no-store" });
                const s: StatusResp = await sRes.json();
                if (!cancelled) setJobStatus(s);

                const lRes = await fetch(`/api/sentinel/restore/logs?offset=${logOffset}`, { cache: "no-store" });
                const l = await lRes.json();
                if (!cancelled) {
                    if (l.chunk) setLogText((t) => t + l.chunk);
                    if (typeof l.next_offset === "number") setLogOffset(l.next_offset);
                    if (l.eof && (s.status === "succeeded" || s.status === "failed")) {
                        setPolling(false);
                        if (s.status === "succeeded" && s.job?.kind === "backup") {
                            loadBackups().catch(() => {});
                        }
                    }
                }
            } catch {
                /* ignore; keep trying */
            }
        };
        tick();
        const id = setInterval(tick, 1500);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, [polling, logOffset, loadBackups]);

    const ensureMaintUser = async () => {
        setEnsuring(true);
        setEnsureMsg(null);
        try {
            const res = await fetch("/api/sentinel/maintenance/bootstrap", { method: "POST" });
            const j = await res.json();
            if (!res.ok) throw new Error(j?.details || j?.error || `Failed: ${res.status}`);
            setEnsureMsg(`Maintenance user ${j.role} ${j.action}.`);
        } catch (e: any) {
            setEnsureMsg(e?.message || "Failed to ensure maintenance user");
        } finally {
            setEnsuring(false);
        }
    };

    const startBackup = async () => {
        setError(null);
        setLogText("");
        setLogOffset(0);
        setStarting(true);

        // Helper to POST start with JSON parse + error surfacing
        const doStart = async () => {
            const res = await fetch("/api/sentinel/backups/start", { method: "POST" });
            const j = await res.json().catch(() => ({}));
            if (!res.ok) {
                const msg = j?.error || `Failed: ${res.status}`;
                const err = new Error(msg) as any;
                err.status = res.status;
                err.body = j;
                throw err;
            }
            return j;
        };

        try {
            // Best-effort: ensure admin role exists
            await ensureMaintUser().catch(() => {});

            // Warm the route module, then try start; if it fails once (cold compile or race),
            // wait briefly, warm again, and retry once.
            await warmStartRoute();
            let j: any;
            try {
                j = await doStart();
            } catch (e1: any) {
                await new Promise((r) => setTimeout(r, 200));
                await warmStartRoute();
                j = await doStart();
            }

            setJobStatus({
                ok: true,
                status: j.status,
                phase: j.phase,
                job: {
                    id: j.job_id,
                    kind: "backup",
                    started_at: j.started_at,
                    finished_at: null,
                    log_file: j.log_file || "",
                    backup_file: j.backup_file,
                    pruned: j.pruned,
                    error: null,
                },
            });
            setPolling(true);
        } catch (e: any) {
            setError(e?.message || "Failed to start backup");
        } finally {
            setStarting(false);
        }
    };

    const running = jobStatus?.status === "running";

    return (
        <div style={{ maxWidth: 980, margin: "24px auto", padding: "0 16px" }}>
            <h1 style={{ fontSize: 22, margin: 0, marginBottom: 12 }}>Backups</h1>

            {error ? <div style={errBox}>{error}</div> : null}

            {/* Maintenance user ensure */}
            <div style={cardStyle}>
                <div style={rowHeader}>
                    <h2 style={h2}>Maintenance User</h2>
                    <span style={{ opacity: 0.8, fontSize: 12 }}>
            Ensure <code>MAINT_DB_USER</code> exists with proper privileges
          </span>
                </div>

                <p style={{ opacity: 0.85, marginTop: 0 }}>
                    Backups and restores run as an administrative database role. Click this once to create/update it from your <code>.env</code>.
                </p>

                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <button onClick={ensureMaintUser} style={btnPrimary} disabled={ensuring || running || starting}>
                        {ensuring ? "Ensuring…" : "Ensure maintenance user"}
                    </button>
                    {ensureMsg ? <span style={{ opacity: 0.9 }}>{ensureMsg}</span> : null}
                </div>
            </div>

            {/* Start backup */}
            <div style={cardStyle}>
                <div style={rowHeader}>
                    <h2 style={h2}>Create Backup</h2>
                    <button onClick={loadBackups} style={btnSecondary} disabled={loading}>
                        Reload list
                    </button>
                </div>

                <p style={{ opacity: 0.85, marginTop: 0 }}>
                    This will create a compressed dump in <code>/storage/backups</code> and prune old backups based on retention.
                </p>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button onClick={startBackup} style={btnPrimary} disabled={running || starting}>
                        {starting ? "Starting…" : running ? "Backup running…" : "Start backup"}
                    </button>
                    <button onClick={() => { setLogText(""); setLogOffset(0); }} style={btnSecondary} disabled={starting}>
                        Clear logs
                    </button>
                </div>
            </div>

            {/* Status & Logs */}
            <div style={cardStyle}>
                <div style={rowHeader}>
                    <h2 style={h2}>Status</h2>
                    <span style={{ opacity: 0.8, fontSize: 12 }}>
            {jobStatus?.status ? `Current: ${jobStatus.status}${jobStatus.phase ? ` · ${jobStatus.phase}` : ""}` : "Idle"}
          </span>
                </div>

                {jobStatus?.job ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div className="muted">Job ID</div>
                        <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{jobStatus.job.id}</div>
                        <div className="muted">Started</div>
                        <div>{fmtDate(jobStatus.job.started_at)}</div>
                        <div className="muted">Finished</div>
                        <div>{fmtDate(jobStatus.job.finished_at)}</div>
                        <div className="muted">Backup file</div>
                        <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{jobStatus.job.backup_file || "—"}</div>
                        <div className="muted">Pruned (old files)</div>
                        <div>{jobStatus.job.pruned ?? "—"}</div>
                        <div className="muted">Error</div>
                        <div style={{ color: "#fca5a5" }}>{jobStatus.job.error || "—"}</div>
                    </div>
                ) : (
                    <p style={{ opacity: 0.8 }}>No active job.</p>
                )}

                <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Logs</div>
                    <textarea
                        value={logText}
                        readOnly
                        style={{
                            width: "100%",
                            minHeight: 260,
                            background: "#0f0f0f",
                            color: "#eaeaea",
                            border: "1px solid #222",
                            borderRadius: 8,
                            padding: 10,
                            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                            fontSize: 12,
                            whiteSpace: "pre-wrap",
                        }}
                    />
                </div>
            </div>

            {/* Backup list */}
            <div style={cardStyle}>
                <div style={rowHeader}>
                    <h2 style={h2}>Available Backups</h2>
                    <span style={{ opacity: 0.8, fontSize: 12 }}>
            {loading ? "Loading…" : `${backups.length} file${backups.length === 1 ? "" : "s"}`}
          </span>
                </div>

                {!backups.length ? (
                    <p style={{ opacity: 0.8 }}>No backups found in <code>/storage/backups</code>.</p>
                ) : (
                    <div style={{ maxHeight: 360, overflow: "auto", border: "1px solid #222", borderRadius: 8 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, padding: "8px 10px", opacity: 0.8, fontSize: 12, borderBottom: "1px solid #1f1f1f" }}>
                            <div>File</div>
                            <div>Size</div>
                            <div>Modified</div>
                        </div>
                        {backups.map((f) => (
                            <div
                                key={f.abspath}
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr auto auto",
                                    gap: 8,
                                    alignItems: "center",
                                    padding: "8px 10px",
                                    borderBottom: "1px solid #1f1f1f",
                                }}
                                title={f.abspath}
                            >
                                <div>
                                    <div style={{ fontWeight: 600 }}>{f.name}</div>
                                    <div style={{ fontSize: 12, opacity: 0.8 }}>{f.relpath}</div>
                                </div>
                                <div style={{ fontSize: 12, opacity: 0.85 }}>{fmtBytes(f.size)}</div>
                                <div style={{ fontSize: 12, opacity: 0.85 }}>{fmtDate(f.mtime)}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

/* ---------------- styles ---------------- */

const cardStyle: React.CSSProperties = {
    background: "#111",
    border: "1px solid #262626",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
};

const rowHeader: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
};

const h2: React.CSSProperties = { margin: 0, fontSize: 18 };

const btnBase: React.CSSProperties = {
    borderRadius: 8,
    padding: "8px 12px",
    border: "1px solid #2b2b2b",
    background: "#151515",
    color: "#eaeaea",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
    textDecoration: "none",
};

const btnPrimary: React.CSSProperties = {
    ...btnBase,
    background: "#1e293b",
    borderColor: "#3b82f6",
};

const btnSecondary: React.CSSProperties = { ...btnBase };

const errBox: React.CSSProperties = {
    background: "#3b0f12",
    border: "1px solid #5b1a1f",
    color: "#ffd7d7",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
};
