"use client";

import { useCallback, useEffect, useState } from "react";

type CoverSyncStatus = {
    status?: "idle" | "running" | "completed" | "failed" | string;
    started_at?: string | null;
    finished_at?: string | null;
    result?: {
        total?: number;
        cached?: number;
        already_cached?: number;
        failed?: number;
        failed_game_ids?: number[];
    } | null;
    error?: string | null;
    detail?: string | null;
};

type FailedGame = { id: number; name: string };

async function readResponse(response: Response): Promise<CoverSyncStatus> {
    const text = await response.text();
    let body: CoverSyncStatus = {};
    if (text) {
        try {
            body = JSON.parse(text) as CoverSyncStatus;
        } catch {
            body = { detail: text };
        }
    }
    if (!response.ok) throw new Error(body.error || body.detail || `Cover image sync failed (${response.status})`);
    return body;
}

function formatDate(value?: string | null) {
    return value ? new Date(value).toLocaleString() : "—";
}

export default function CoverImageSync() {
    const [status, setStatus] = useState<CoverSyncStatus | null>(null);
    const [starting, setStarting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [failedGames, setFailedGames] = useState<FailedGame[]>([]);

    const loadStatus = useCallback(async () => {
        const response = await fetch("/api/admin/games/sync-cover-images", {
            cache: "no-store",
            headers: { Accept: "application/json" },
        });
        const next = await readResponse(response);
        setStatus(next);
        return next;
    }, []);

    useEffect(() => {
        void loadStatus().catch(() => {
            // The status endpoint is optional until the administrator starts a sync.
        });
    }, [loadStatus]);

    const running = status?.status === "running";
    const failedGameIds = status?.result?.failed_game_ids ?? [];
    const failedGameIdsKey = failedGameIds.join(",");

    useEffect(() => {
        if (!failedGameIds.length) {
            setFailedGames([]);
            return;
        }
        let cancelled = false;
        void Promise.all(failedGameIds.map(async (id): Promise<FailedGame> => {
            try {
                const response = await fetch(`/api/proxy/games/${id}`, { cache: "no-store" });
                if (!response.ok) throw new Error();
                const game = await response.json() as { id?: number; name?: string };
                return { id, name: game.name?.trim() || `Game #${id}` };
            } catch {
                return { id, name: `Game #${id}` };
            }
        })).then((games) => {
            if (!cancelled) setFailedGames(games);
        });
        return () => { cancelled = true; };
    }, [failedGameIdsKey]);

    useEffect(() => {
        if (!running) return;
        let cancelled = false;
        const poll = async () => {
            try {
                const next = await loadStatus();
                if (!cancelled && next.status === "failed") setError(next.error || next.detail || "Cover image sync failed.");
            } catch (cause) {
                if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not check cover image sync status.");
            }
        };
        void poll();
        const timer = window.setInterval(() => void poll(), 3000);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [loadStatus, running]);

    async function start() {
        setStarting(true);
        setError(null);
        try {
            const response = await fetch("/api/admin/games/sync-cover-images", {
                method: "POST",
                cache: "no-store",
                headers: { Accept: "application/json" },
            });
            const next = await readResponse(response);
            setStatus(next.status ? next : { status: "running" });
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not start cover image sync.");
        } finally {
            setStarting(false);
        }
    }

    const result = status?.result;
    const buttonStyle: React.CSSProperties = {
        background: "var(--gc-accent)", color: "#fff", border: 0, borderRadius: 8,
        padding: "9px 12px", fontWeight: 700, cursor: running || starting ? "wait" : "pointer",
    };

    return (
        <section aria-labelledby="cover-sync-title">
            <h2 id="cover-sync-title" style={{ fontSize: 16, margin: "0 0 6px" }}>Cover images</h2>
            <p style={{ opacity: 0.8, margin: "0 0 12px" }}>
                Cache library-game covers in GameCubby storage. This runs in the background.
            </p>
            <button type="button" style={buttonStyle} onClick={() => void start()} disabled={running || starting}>
                {starting ? "Starting…" : running ? "Syncing Cover Images…" : "Sync Cover Images"}
            </button>

            {error ? <div role="alert" style={{ color: "#fca5a5", marginTop: 10 }}>{error}</div> : null}

            {status && status.status !== "idle" ? (
                <div role="status" aria-live="polite" style={{ marginTop: 12, padding: 10, borderRadius: 8, border: "1px solid var(--gc-border)", background: "var(--gc-surface-raised)", display: "grid", gap: 6, fontSize: 13 }}>
                    <strong>{running ? "Syncing cover images…" : status.status === "completed" ? "Cover image sync completed." : status.status === "failed" ? "Cover image sync failed." : `Status: ${status.status}`}</strong>
                    {running && result ? <div>{result.cached ?? 0} newly cached, {result.already_cached ?? 0} already available.</div> : null}
                    {status.started_at ? <div>Started: {formatDate(status.started_at)}</div> : null}
                    {status.finished_at ? <div>Finished: {formatDate(status.finished_at)}</div> : null}
                    {result ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 6, marginTop: 2 }}>
                        <span>Total games checked: {result.total ?? 0}</span>
                        <span>Newly cached covers: {result.cached ?? 0}</span>
                        <span>Already cached: {result.already_cached ?? 0}</span>
                        <span>Failed covers: {result.failed ?? 0}</span>
                    </div> : null}
                    {(result?.failed ?? 0) > 0 ? <div style={{ color: "#fde68a" }}>Some source image URLs may be unavailable. Those games will continue to use their existing fallback or placeholder image.</div> : null}
                    {failedGames.length > 0 ? <div style={{ marginTop: 4 }}>
                        <strong>Games with missing cover images</strong>
                        <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
                            {failedGames.map((game) => <a key={game.id} href={`/admin/games/update/${game.id}`} target="_blank" rel="noopener noreferrer" style={{ color: "#bfdbfe", width: "fit-content" }}>
                                {game.name} <span style={{ opacity: 0.8 }}>(edit cover)</span>
                            </a>)}
                        </div>
                    </div> : null}
                    {status.status === "failed" && status.error ? <div style={{ color: "#fca5a5" }}>{status.error}</div> : null}
                </div>
            ) : null}
        </section>
    );
}
