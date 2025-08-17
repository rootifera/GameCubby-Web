"use client";

import React, { useEffect, useMemo, useState } from "react";

type Entry = { key: string; value: string };

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, { cache: "no-store", ...init });
    const text = await res.text();
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}${text ? `: ${text.slice(0, 200)}` : ""}`);
    return (text ? JSON.parse(text) : {}) as T;
}

export default function SettingsAppForm() {
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const [entries, setEntries] = useState<Entry[]>([]);

    // Local fields we actually edit/display
    const [clientId, setClientId] = useState("");
    const [clientSecret, setClientSecret] = useState("");
    const [showClientId, setShowClientId] = useState(false);
    const [showClientSecret, setShowClientSecret] = useState(false);

    const [publicDownloads, setPublicDownloads] = useState<boolean>(false);
    const [queryLimit, setQueryLimit] = useState<string>("");

    // Load all config
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setErr(null);
            setNotice(null);
            try {
                const arr = await fetchJSON<Entry[]>("/api/admin/app_config");
                if (cancelled) return;

                setEntries(Array.isArray(arr) ? arr : []);

                const find = (k: string) => (arr as Entry[]).find((e) => e.key === k)?.value ?? "";

                setClientId(find("CLIENT_ID"));
                setClientSecret(find("CLIENT_SECRET"));

                const pub = find("public_downloads_enabled");
                setPublicDownloads(String(pub).toLowerCase() === "true");

                setQueryLimit(find("QUERY_LIMIT") || "");
            } catch (e: any) {
                if (!cancelled) setErr(e?.message ?? "Failed to load settings");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const original = useMemo(() => {
        const map = new Map(entries.map((e) => [e.key, e.value]));
        return {
            CLIENT_ID: map.get("CLIENT_ID") ?? "",
            CLIENT_SECRET: map.get("CLIENT_SECRET") ?? "",
            public_downloads_enabled: map.get("public_downloads_enabled") ?? "",
            QUERY_LIMIT: map.get("QUERY_LIMIT") ?? "",
            // intentionally ignore is_firstrun_done & SECRET_KEY
        };
    }, [entries]);

    function mask(s: string) {
        if (!s) return "";
        return "•".repeat(Math.min(20, Math.max(8, Math.floor(s.length * 0.8))));
    }

    async function saveAll(e: React.FormEvent) {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        setNotice(null);

        // Validate
        const qNum = Number(queryLimit.replace(/[^\d]/g, ""));
        if (queryLimit && (!Number.isFinite(qNum) || qNum < 0)) {
            setErr("QUERY_LIMIT must be a non-negative number.");
            setBusy(false);
            return;
        }

        // Build changed entries (POST one by one)
        const changes: Entry[] = [];

        if (clientId !== original.CLIENT_ID) {
            changes.push({ key: "CLIENT_ID", value: clientId });
        }
        if (clientSecret !== original.CLIENT_SECRET) {
            changes.push({ key: "CLIENT_SECRET", value: clientSecret });
        }

        const publicStr = publicDownloads ? "true" : "false";
        if (publicStr !== original.public_downloads_enabled) {
            changes.push({ key: "public_downloads_enabled", value: publicStr });
        }

        const qStr = queryLimit ? String(qNum) : "";
        if (qStr !== original.QUERY_LIMIT) {
            changes.push({ key: "QUERY_LIMIT", value: qStr });
        }

        try {
            for (const ch of changes) {
                await fetchJSON<Entry>("/api/admin/app_config", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(ch),
                });
            }

            setNotice(changes.length ? "Settings saved." : "No changes to save.");

            // Update originals to current (so subsequent saves only send new changes)
            setEntries((prev) => {
                const map = new Map(prev.map((e) => [e.key, e.value]));
                for (const ch of changes) map.set(ch.key, ch.value);
                return Array.from(map.entries()).map(([key, value]) => ({ key, value }));
            });
        } catch (e: any) {
            setErr(e?.message ?? "Save failed");
        } finally {
            setBusy(false);
        }
    }

    /* styles */
    const input = {
        background: "#121212",
        color: "#eaeaea",
        border: "1px solid #262626",
        borderRadius: 8,
        padding: "8px 10px",
        outline: "none",
        width: "100%",
    } as const;

    const btn: React.CSSProperties = {
        display: "inline-block",
        background: "#1e293b",
        color: "#fff",
        border: "1px solid #3b82f6",
        borderRadius: 8,
        padding: "10px 14px",
        fontWeight: 600,
        cursor: busy ? "not-allowed" : "pointer",
        opacity: busy ? 0.85 : 1,
    };

    const ghostBtn: React.CSSProperties = {
        background: "#151515",
        color: "#eaeaea",
        border: "1px solid #2b2b2b",
        borderRadius: 8,
        padding: "8px 10px",
        cursor: "pointer",
        whiteSpace: "nowrap",
    };

    return (
        <form onSubmit={saveAll} style={{ display: "grid", gap: 14, maxWidth: 720 }}>
            {(loading || busy || err || notice) && (
                <div style={{ display: "grid", gap: 8 }}>
                    {loading && (
                        <div style={{ background: "#1b1b1b", border: "1px solid #2e2e2e", padding: 10, borderRadius: 8 }}>
                            Loading…
                        </div>
                    )}
                    {busy && (
                        <div style={{ background: "#1b1b1b", border: "1px solid #2e2e2e", padding: 10, borderRadius: 8 }}>
                            Saving…
                        </div>
                    )}
                    {notice && (
                        <div style={{ background: "#102418", border: "1px solid #214d2c", padding: 10, borderRadius: 8 }}>
                            {notice}
                        </div>
                    )}
                    {err && (
                        <div
                            style={{
                                background: "#3b0f12",
                                border: "1px solid #5b1a1f",
                                padding: 10,
                                borderRadius: 8,
                                color: "#ffd7d7",
                            }}
                        >
                            {err}
                        </div>
                    )}
                </div>
            )}

            {/* CLIENT_ID */}
            <section style={{ background: "#141414", border: "1px solid #262626", borderRadius: 10, padding: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>IGDB Client</div>

                <div style={{ display: "grid", gap: 10 }}>
                    <label style={{ display: "grid", gap: 6 }}>
                        <span style={{ opacity: 0.85, fontSize: 12 }}>CLIENT_ID</span>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                            <input
                                type={showClientId ? "text" : "password"}
                                value={clientId}
                                onChange={(e) => setClientId(e.target.value)}
                                style={input}
                                placeholder="CLIENT_ID"
                            />
                            <button
                                type="button"
                                onClick={() => setShowClientId((v) => !v)}
                                style={ghostBtn}
                                aria-label={showClientId ? "Hide CLIENT_ID" : "Show CLIENT_ID"}
                            >
                                {showClientId ? "Hide" : "View"}
                            </button>
                        </div>
                    </label>

                    <label style={{ display: "grid", gap: 6 }}>
                        <span style={{ opacity: 0.85, fontSize: 12 }}>CLIENT_SECRET</span>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                            <input
                                type={showClientSecret ? "text" : "password"}
                                value={clientSecret}
                                onChange={(e) => setClientSecret(e.target.value)}
                                style={input}
                                placeholder="CLIENT_SECRET"
                            />

                            <button
                                type="button"
                                onClick={() => setShowClientSecret((v) => !v)}
                                style={ghostBtn}
                                aria-label={showClientSecret ? "Hide CLIENT_SECRET" : "Show CLIENT_SECRET"}
                            >
                                {showClientSecret ? "Hide" : "View"}
                            </button>
                        </div>
                    </label>
                </div>
            </section>

            {/* Public downloads */}
            <section style={{ background: "#141414", border: "1px solid #262626", borderRadius: 10, padding: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Downloads</div>
                <div style={{ display: "grid", gap: 6 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <input
                            type="checkbox"
                            checked={publicDownloads}
                            onChange={(e) => setPublicDownloads(e.target.checked)}
                        />
                        <span>Enable public downloads (no login required)</span>
                    </label>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                        When enabled, users without admin access can download files via the public proxy.
                    </div>
                </div>
            </section>

            {/* Query limit */}
            <section style={{ background: "#141414", border: "1px solid #262626", borderRadius: 10, padding: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Search</div>
                <label style={{ display: "grid", gap: 6, maxWidth: 240 }}>
                    <span style={{ opacity: 0.85, fontSize: 12 }}>QUERY_LIMIT</span>
                    <input
                        value={queryLimit}
                        onChange={(e) => setQueryLimit(e.target.value.replace(/[^\d]/g, ""))}
                        inputMode="numeric"
                        pattern="\d*"
                        placeholder="e.g. 50"
                        style={input}
                    />
                </label>
                {(() => {
                    const n = Number(queryLimit || "0");
                    return Number.isFinite(n) && n > 200 ? (
                        <div style={{ marginTop: 6, background: "#3b2d0f", border: "1px solid #5b4a1f", padding: 8, borderRadius: 8 }}>
                            Setting QUERY_LIMIT above 200 may impact performance.
                        </div>
                    ) : null;
                })()}
            </section>

            {/* Save */}
            <div>
                <button type="submit" style={btn} disabled={busy || loading}>
                    {busy ? "Saving…" : "Save Settings"}
                </button>
            </div>
        </form>
    );
}
