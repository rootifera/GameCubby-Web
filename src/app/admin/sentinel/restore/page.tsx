"use client";

import React from "react";

type MaintStatus = {
    enabled: boolean;
    reason?: string | null;
    by?: string | null;
    started_at?: string | null;
};

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
        kind: "restore" | "backup";
        started_at: string;
        finished_at: string | null;
        log_file: string;
        dump_path?: string;     // restore
        pre_dump_file?: string | null;
        backup_file?: string;   // backup
        pruned?: number;
        error: string | null;
    };
};

export default function RestorePage() {
    // maintenance
    const [maint, setMaint] = React.useState<MaintStatus | null>(null);
    const [loadingMaint, setLoadingMaint] = React.useState(false);

    // backups
    const [backups, setBackups] = React.useState<BackupFile[]>([]);
    const [loadingBackups, setLoadingBackups] = React.useState(false);

    // selection + options
    const [dumpPath, setDumpPath] = React.useState("");
    const [preDump, setPreDump] = React.useState(true);

    // job + logs
    const [jobStatus, setJobStatus] = React.useState<StatusResp | null>(null);
    const [logText, setLogText] = React.useState("");
    const [logOffset, setLogOffset] = React.useState(0);
    const [polling, setPolling] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const fmtBytes = (n: number) => {
        if (n < 1024) return `${n} B`;
        if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
        if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
        return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    };
    const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleString() : "—");

    const loadMaint = React.useCallback(async () => {
        setLoadingMaint(true);
        try {
            const res = await fetch("/api/sentinel/maintenance/status", { cache: "no-store" });
            const j = await res.json();
            setMaint({ enabled: !!j.enabled, reason: j.reason, by: j.by, started_at: j.started_at });
        } catch {
            /* ignore */
        } finally {
            setLoadingMaint(false);
        }
    }, []);

    const enterMaint = React.useCallback(async () => {
        setError(null);
        try {
            const res = await fetch("/api/sentinel/maintenance/enter", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });
            const j = await res.json();
            if (!res.ok) throw new Error(j?.error || `Failed: ${res.status}`);
            await loadMaint();
        } catch (e: any) {
            setError(e?.message || "Failed to enter maintenance");
        }
    }, [loadMaint]);

    const exitMaint = React.useCallback(async () => {
        setError(null);
        try {
            const res = await fetch("/api/sentinel/maintenance/exit", { method: "POST" });
            const j = await res.json();
            if (!res.ok) throw new Error(j?.error || `Failed: ${res.status}`);
            await loadMaint();
        } catch (e: any) {
            setError(e?.message || "Failed to exit maintenance");
        }
    }, [loadMaint]);

    const loadBackups = React.useCallback(async () => {
        setLoadingBackups(true);
        try {
            const res = await fetch("/api/sentinel/backups/list", { cache: "no-store" });
            const j = await res.json();
            const files: BackupFile[] = Array.isArray(j.files) ? j.files : [];
            setBackups(files);
            if (!dumpPath && files.length) setDumpPath(files[0].abspath);
        } catch (e: any) {
            setError(e?.message || "Failed to load backups");
        } finally {
            setLoadingBackups(false);
        }
    }, [dumpPath]);

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

    React.useEffect(() => {
        Promise.all([loadMaint(), loadBackups(), loadStatusOnce()]).catch(() => {});
    }, [loadMaint, loadBackups, loadStatusOnce]);

    // Poll job status + logs
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
                        if (s.status === "succeeded") loadBackups().catch(() => {});
                    }
                }
            } catch {
                /* keep trying */
            }
        };

        tick();
        const id = setInterval(tick, 1500);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, [polling, logOffset, loadBackups]);

    const startRestore = async () => {
        setError(null);
        setLogText("");
        setLogOffset(0);

        if (!maint?.enabled) {
            setError("Maintenance must be enabled before starting a restore.");
            return;
        }
        if (!dumpPath) {
            setError("Please select a backup file to restore.");
            return;
        }

        try {
            const res = await fetch("/api/sentinel/restore/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dump_path: dumpPath, pre_dump: preDump }),
            });
            const j = await res.json();
            if (!res.ok) throw new Error(j?.error || `Failed: ${res.status}`);
            setJobStatus({
                ok: true,
                status: j.status,
                phase: j.phase,
                job: {
                    id: j.job_id,
                    kind: "restore",
                    started_at: j.started_at,
                    finished_at: null,
                    log_file: j.log_file || "",
                    dump_path: j.dump_path,
                    pre_dump_file: null,
                    backup_file: undefined,
                    error: null,
                    pruned: undefined,
                },
            });
            setPolling(true);
        } catch (e: any) {
            setError(e?.message || "Failed to start restore");
        }
    };

    const running = jobStatus?.status === "running";
    const finished = jobStatus?.status === "succeeded" || jobStatus?.status === "failed";

    return (
        <div style={{ maxWidth: 980, margin: "24px auto", padding: "0 16px" }}>
            <h1 style={{ fontSize: 22, margin: 0, marginBottom: 12 }}>Restore Database</h1>

            {error ? (
                <div
                    style={{
                        background: "#3b0f12",
                        border: "1px solid #5b1a1f",
                        color: "#ffd7d7",
                        padding: 12,
                        borderRadius: 8,
                        marginBottom: 16,
                    }}
                >
                    {error}
                </div>
            ) : null}

            {/* Maintenance controls */}
            <div style={cardStyle}>
                <div style={rowHeader}>
                    <h2 style={h2}>Maintenance Mode</h2>
                    <span style={{ opacity: 0.8, fontSize: 12 }}>
            {loadingMaint ? "Checking…" : maint?.enabled ? "Enabled" : "Disabled"}
          </span>
                </div>

                <p style={{ opacity: 0.85, marginTop: 0 }}>
                    When enabled, the API and UI are restricted; only this page and Sentinel API endpoints remain accessible.
                </p>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button onClick={enterMaint} style={btnPrimary} disabled={maint?.enabled || loadingMaint || running}>
                        Enable maintenance
                    </button>
                    <button onClick={exitMaint} style={btnSecondary} disabled={!maint?.enabled || loadingMaint || running}>
                        Disable maintenance
                    </button>
                    <button onClick={loadMaint} style={btnSecondary}>Refresh status</button>
                </div>
            </div>

            {/* Pick backup */}
            <div style={cardStyle}>
                <div style={rowHeader}>
                    <h2 style={h2}>Select Backup</h2>
                    <button onClick={loadBackups} style={btnSecondary} disabled={loadingBackups}>
                        Reload
                    </button>
                </div>

                {!backups.length ? (
                    <p style={{ opacity: 0.8 }}>
                        {loadingBackups ? "Loading…" : "No backups found in /storage/backups"}
                    </p>
                ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 12 }}>
                            <label style={{ display: "grid", gap: 6 }}>
                                <span style={{ opacity: 0.85 }}>Backup file (absolute path inside container)</span>
                                <input
                                    value={dumpPath}
                                    onChange={(e) => setDumpPath(e.currentTarget.value)}
                                    placeholder="/storage/backups/backup_gamecubby_YYYYMMDD_HHMMSS.dump"
                                    style={input}
                                />
                            </label>
                            <label style={{ display: "flex", alignItems: "center", gap: 8, opacity: 0.9 }}>
                                <input
                                    type="checkbox"
                                    checked={preDump}
                                    onChange={(e) => setPreDump(e.currentTarget.checked)}
                                />
                                Take pre-restore snapshot
                            </label>
                        </div>

                        <div style={{ maxHeight: 300, overflow: "auto", border: "1px solid #222", borderRadius: 8 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, padding: "8px 10px", opacity: 0.8, fontSize: 12, borderBottom: "1px solid #1f1f1f" }}>
                                <div>File</div>
                                <div>Size</div>
                                <div>Modified</div>
                            </div>
                            {backups.map((f) => {
                                const selected = dumpPath === f.abspath;
                                return (
                                    <button
                                        key={f.abspath}
                                        onClick={() => setDumpPath(f.abspath)}
                                        style={{
                                            display: "grid",
                                            gridTemplateColumns: "1fr auto auto",
                                            gap: 8,
                                            alignItems: "center",
                                            padding: "8px 10px",
                                            width: "100%",
                                            textAlign: "left",
                                            background: selected ? "#1e293b" : "#0f0f0f",
                                            color: "#eaeaea",
                                            border: "none",
                                            borderBottom: "1px solid #1f1f1f",
                                            cursor: "pointer",
                                        }}
                                        title={f.abspath}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{f.name}</div>
                                            <div style={{ fontSize: 12, opacity: 0.8 }}>{f.relpath}</div>
                                        </div>
                                        <div style={{ fontSize: 12, opacity: 0.85 }}>{fmtBytes(f.size)}</div>
                                        <div style={{ fontSize: 12, opacity: 0.85 }}>{fmtDate(f.mtime)}</div>
                                    </button>
                                );
                            })}
                        </div>

                        <div style={{ display: "flex", gap: 8 }}>
                            <button
                                onClick={startRestore}
                                style={btnPrimary}
                                disabled={!maint?.enabled || !dumpPath || running}
                            >
                                Start restore
                            </button>
                            <button onClick={() => { setLogText(""); setLogOffset(0); }} style={btnSecondary}>
                                Clear logs
                            </button>
                        </div>
                    </div>
                )}
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
                        <div className="muted">Dump file</div>
                        <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{jobStatus.job.dump_path || "—"}</div>
                        <div className="muted">Pre-restore snapshot</div>
                        <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{jobStatus.job.pre_dump_file || "—"}</div>
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

                <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button onClick={() => setPolling(true)} style={btnSecondary} disabled={running}>
                        {running ? "Polling…" : "Poll status"}
                    </button>
                    <button onClick={() => { setLogText(""); setLogOffset(0); }} style={btnSecondary}>
                        Clear logs
                    </button>
                    <button onClick={exitMaint} style={btnSecondary} disabled={!maint?.enabled || running || !finished}>
                        Exit maintenance
                    </button>
                </div>
            </div>

            {/* Warning */}
            <div style={{ ...cardStyle, background: "#120f0f", borderColor: "#2b1f1f" }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Heads up</div>
                <ul style={{ margin: 0, paddingLeft: 18, opacity: 0.9 }}>
                    <li>Make sure the selected dump matches your Postgres major version.</li>
                    <li>During restore, the app DB user is locked and active sessions are terminated.</li>
                    <li>If anything fails, the system tries to re-enable the app user automatically.</li>
                </ul>
            </div>
        </div>
    );
}

/* ------------- styles ------------- */
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

const input: React.CSSProperties = {
    background: "#1a1a1a",
    color: "#eaeaea",
    border: "1px solid #2b2b2b",
    borderRadius: 8,
    padding: "10px 12px",
    outline: "none",
};

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
