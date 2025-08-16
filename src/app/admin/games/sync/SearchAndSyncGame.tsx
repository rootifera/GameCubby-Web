"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import TagChipsAutocomplete from "@/components/TagChipsAutocomplete";
import CoverThumb from "@/components/CoverThumb";
import GameHoverCard from "@/components/GameHoverCard";

/* ------------ types ------------ */
type Named = { id: number; name: string };
type GameListItem = {
    id: number;
    name: string;
    cover_url?: string | null;
    release_date?: number | null; // year or unix
    platforms?: Named[];
    rating?: number | null;
};

type DetailsLite = { id: number; igdb_id?: number | null };
type RefreshResult = { updated: boolean; message: string };
type BulkInfo = { status?: string; detail?: string };

/* ------------ helpers ------------ */
function toYearNumber(n?: number | null): number | null {
    if (n == null) return null;
    if (n >= 1000 && n <= 3000) return n;
    if (n >= 1_000_000_000_000) return new Date(n).getUTCFullYear(); // ms
    if (n >= 1_000_000_000) return new Date(n * 1000).getUTCFullYear(); // sec
    return n;
}
function toYearLabel(n?: number | null): string {
    const y = toYearNumber(n);
    return y == null ? "—" : String(y);
}
function parseIdsCSV(csv: string): number[] {
    return csv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => Number(s))
        .filter((n) => Number.isFinite(n));
}

/** Build query equivalent to Basic Search (single platform). */
function buildBasicQuery(params: {
    q: string;
    year: string;
    platform_id: string; // single-select
    tag_ids_csv: string;
    match_mode: "any" | "all" | "exact";
    size: number;
    page: number;
}) {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q); // proxy maps q -> name
    if (params.year) sp.set("year", params.year);
    if (params.platform_id) sp.set("platform_id", params.platform_id);
    if (params.match_mode) sp.set("match_mode", params.match_mode);
    const tIds = params.tag_ids_csv ? parseIdsCSV(params.tag_ids_csv) : [];
    for (const t of tIds) sp.append("tag_ids", String(t));
    sp.set("size", String(params.size));
    sp.set("page", String(params.page));
    return sp.toString();
}

/* ------------ component ------------ */
export default function SearchAndSyncGame({ initialPlatforms }: { initialPlatforms: Named[] }) {
    // Filters (Basic Search — single platform)
    const [q, setQ] = useState("");
    const [year, setYear] = useState("");
    const [platformId, setPlatformId] = useState<string>(""); // SINGLE
    const [tagCsv, setTagCsv] = useState(""); // synced from hidden input rendered by TagChipsAutocomplete
    const [matchMode, setMatchMode] = useState<"any" | "all" | "exact">("any");
    const [size, setSize] = useState(20);

    // force remount for TagChipsAutocomplete on reset
    const [resetKey, setResetKey] = useState(0);

    // Data
    const [results, setResults] = useState<GameListItem[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    // IGDB-only filter support: details map (id -> igdb_id)
    const [details, setDetails] = useState<Map<number, DetailsLite>>(new Map());
    const [detailsLoading, setDetailsLoading] = useState(false);

    // Per-row refresh status
    const [rowBusy, setRowBusy] = useState<number | null>(null);
    const [rowMsg, setRowMsg] = useState<Map<number, RefreshResult>>(new Map());

    // Bulk actions
    const [bulkBusy, setBulkBusy] = useState<null | "refresh_all" | "force_refresh">(null);
    const [bulkMsg, setBulkMsg] = useState<string | null>(null);
    const [bulkInfo, setBulkInfo] = useState<BulkInfo | null>(null); // ← pretty JSON banner

    // Observe TagChipsAutocomplete's hidden input value (name="tag_ids")
    const tagsHostRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const host = tagsHostRef.current;
        if (!host) return;

        const input = host.querySelector('input[name="tag_ids"]') as HTMLInputElement | null;
        if (!input) return;

        const updateFromInput = () => setTagCsv(input.value || "");
        updateFromInput();

        input.addEventListener("input", updateFromInput);
        input.addEventListener("change", updateFromInput);

        const mo = new MutationObserver(updateFromInput);
        mo.observe(input, { attributes: true, attributeFilter: ["value"] });

        return () => {
            input.removeEventListener("input", updateFromInput);
            input.removeEventListener("change", updateFromInput);
            mo.disconnect();
        };
    }, [tagsHostRef.current, resetKey]);

    // Reset everything (including Tags)
    function resetAll() {
        setQ("");
        setYear("");
        setPlatformId("");
        setMatchMode("any");
        setSize(20);
        setTagCsv("");
        setResults(null);
        setErr(null);
        setDetails(new Map());
        setRowBusy(null);
        setRowMsg(new Map());
        setBulkBusy(null);
        setBulkMsg(null);
        setBulkInfo(null); // ← clear pretty banner
        setResetKey((k) => k + 1);

        const host = tagsHostRef.current;
        const input = host?.querySelector('input[name="tag_ids"]') as HTMLInputElement | null;
        if (input) {
            input.value = "";
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
        }
    }

    // Run search with debounce when filters change
    useEffect(() => {
        const hasAny = q.trim() || year.trim() || platformId.trim() || tagCsv.trim();
        if (!hasAny) {
            setResults(null);
            setErr(null);
            return;
        }

        const ctrl = new AbortController();
        const timer = setTimeout(async () => {
            setLoading(true);
            setErr(null);
            setRowMsg(new Map());
            try {
                const qs = buildBasicQuery({
                    q: q.trim(),
                    year: year.trim(),
                    platform_id: platformId.trim(),
                    tag_ids_csv: tagCsv,
                    match_mode: matchMode,
                    size,
                    page: 1,
                });

                const url = `/api/proxy/search/basic?${qs}`;
                const res = await fetch(url, {
                    method: "GET",
                    headers: { Accept: "application/json" },
                    cache: "no-store",
                    signal: ctrl.signal,
                });
                if (!res.ok) {
                    const text = await res.text().catch(() => "");
                    throw new Error(`Search failed (${res.status}) ${text}`);
                }
                const data = await res.json();
                const list: GameListItem[] = Array.isArray(data) ? data : data?.results ?? [];
                setResults(Array.isArray(list) ? list.slice(0, size) : []);
            } catch (e: any) {
                if (e?.name !== "AbortError") setErr(e?.message ?? "Search error");
            } finally {
                setLoading(false);
            }
        }, 250);

        return () => {
            ctrl.abort();
            clearTimeout(timer);
        };
    }, [q, year, platformId, tagCsv, matchMode, size]);

    // After results load, fetch details to filter out custom games (igdb_id = 0)
    useEffect(() => {
        let cancelled = false;
        async function loadDetails(ids: number[]) {
            setDetailsLoading(true);
            try {
                const pairs = await Promise.all(
                    ids.map(async (id) => {
                        try {
                            const res = await fetch(`/api/proxy/games/${id}`, { cache: "no-store" });
                            if (!res.ok) throw new Error();
                            const j = await res.json();
                            const igdb_id = typeof j?.igdb_id === "number" ? j.igdb_id : null;
                            return [id, { id, igdb_id }] as const;
                        } catch {
                            return [id, { id, igdb_id: null }] as const;
                        }
                    })
                );
                if (cancelled) return;
                setDetails((prev) => {
                    const m = new Map(prev);
                    for (const [id, lite] of pairs) m.set(id, lite);
                    return m;
                });
            } finally {
                if (!cancelled) setDetailsLoading(false);
            }
        }

        if (results && results.length) {
            void loadDetails(results.map((r) => r.id));
        }
    }, [results]);

    const filteredResults = useMemo(() => {
        if (!results) return null;
        // Hide custom games: keep only ids with igdb_id > 0
        return results.filter((r) => {
            const d = details.get(r.id);
            return d && typeof d.igdb_id === "number" && d.igdb_id > 0;
        });
    }, [results, details]);

    /* ---- styles ---- */
    const input = {
        background: "#121212",
        color: "#eaeaea",
        border: "1px solid #262626",
        borderRadius: 8,
        padding: "8px 10px",
        outline: "none",
    } as const;

    const btn: React.CSSProperties = {
        display: "inline-block",
        background: "#1b1b1b",
        color: "#eaeaea",
        border: "1px solid #2e2e2e",
        borderRadius: 8,
        padding: "8px 12px",
        textDecoration: "none",
        whiteSpace: "nowrap",
        cursor: "pointer",
    };

    const ghostBtn: React.CSSProperties = {
        ...btn,
        background: "#151515",
        border: "1px solid #2b2b2b",
        color: "#d8d8d8",
    };

    const primaryBtn: React.CSSProperties = {
        ...btn,
        background: "#1e293b",
        border: "1px solid #3b82f6",
        color: "#fff",
        fontWeight: 600,
    };

    const successMsg: React.CSSProperties = { color: "#86efac" };
    const neutralMsg: React.CSSProperties = { color: "#d1d5db" };
    const warnMsg: React.CSSProperties = { color: "#fca5a5" };

    // --- per-row refresh ---
    async function refreshOne(id: number) {
        setRowBusy(id);
        try {
            const res = await fetch(`/api/admin/games/${id}/refresh_metadata`, {
                method: "POST",
                headers: { Accept: "application/json" },
            });
            if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(`(${res.status}) ${text}`);
            }
            const j = (await res.json()) as { updated?: boolean; message?: string };
            const updated = Boolean(j?.updated);
            const message = String(j?.message ?? (updated ? "Updated." : "Already up to date."));
            setRowMsg((prev) => {
                const m = new Map(prev);
                m.set(id, { updated, message });
                return m;
            });
        } catch (e: any) {
            setRowMsg((prev) => {
                const m = new Map(prev);
                m.set(id, { updated: false, message: e?.message ?? "Failed to refresh" });
                return m;
            });
        } finally {
            setRowBusy(null);
        }
    }

    // --- bulk actions ---
    async function bulkRefresh(kind: "refresh_all" | "force_refresh") {
        setBulkBusy(kind);
        setBulkMsg(null);
        setBulkInfo(null); // clear old banner
        try {
            const path =
                kind === "refresh_all"
                    ? "/api/admin/games/refresh_all_metadata"
                    : "/api/admin/games/force_refresh_metadata";
            const res = await fetch(path, { method: "POST", headers: { Accept: "application/json" } });

            // Handle errors with text body to surface details
            if (!res.ok) {
                const errText = await res.text().catch(() => "");
                throw new Error(`(${res.status}) ${errText || "Bulk action failed"}`);
            }

            // Pretty: if JSON with {status, detail}, show a nice banner; else fallback to raw text.
            const ct = res.headers.get("content-type") || "";
            if (ct.includes("application/json")) {
                const data = (await res.json().catch(() => null)) as { status?: string; detail?: string } | null;
                if (data && (data.status || data.detail)) {
                    setBulkInfo({ status: data.status, detail: data.detail });
                    setBulkMsg(null);
                } else {
                    setBulkInfo(null);
                    setBulkMsg(JSON.stringify(data ?? {}).trim() || "Bulk action completed.");
                }
            } else {
                const text = await res.text().catch(() => "");
                setBulkInfo(null);
                setBulkMsg(text || "Bulk action completed.");
            }
        } catch (e: any) {
            setBulkInfo(null);
            setBulkMsg(e?.message ?? "Bulk action failed");
        } finally {
            setBulkBusy(null);
        }
    }

    return (
        <div>
            {/* Filters — Basic Search with single-select platform */}
            <div style={{ display: "grid", gap: 12, marginBottom: 12 }}>
                <input
                    placeholder="Search by game name…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    style={{ ...input }}
                />

                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "200px 350px" }}>
                    <label style={{ display: "grid", gap: 6 }}>
                        <span style={{ opacity: 0.85, fontSize: 12 }}>Year (exact)</span>
                        <input
                            value={year}
                            onChange={(e) => setYear(e.target.value.replace(/[^\d]/g, ""))}
                            inputMode="numeric"
                            placeholder="1990"
                            style={{ ...input }}
                        />
                    </label>

                    <SingleSelectDropdown
                        label="Platform"
                        options={initialPlatforms}
                        value={platformId}
                        onChange={setPlatformId}
                        placeholder="Any"
                        menuWidth={300}
                    />
                </div>

                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 160px" }}>
                    {/* Tags — uses existing component; we read its hidden input value */}
                    <div ref={tagsHostRef} key={resetKey}>
                        <TagChipsAutocomplete label="Tags" name="tag_ids" suggestKind="tags" defaultSelectedIds={[]} />
                    </div>

                    <label style={{ display: "grid", gap: 6 }}>
                        <span style={{ opacity: 0.85, fontSize: 12 }}>Tag match</span>
                        <select
                            value={matchMode}
                            onChange={(e) => setMatchMode((e.target.value as "any" | "all" | "exact") ?? "any")}
                            style={{ ...input }}
                        >
                            <option value="any">Any</option>
                            <option value="all">All</option>
                            <option value="exact">Exact</option>
                        </select>
                    </label>
                </div>

                {/* Reset row + small hint */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                        Custom games are automatically hidden (IGDB ID = 0).
                        {results && (
                            <>
                                {" "}
                                {detailsLoading ? " Filtering…" : ""}
                                {filteredResults && ` Showing ${filteredResults.length} of ${results.length}.`}
                            </>
                        )}
                    </div>
                    <button type="button" onClick={resetAll} style={ghostBtn}>
                        Reset
                    </button>
                </div>

                <label style={{ display: "grid", gap: 6, maxWidth: 160 }}>
                    <span style={{ opacity: 0.85, fontSize: 12 }}>Page size</span>
                    <input
                        value={String(size)}
                        onChange={(e) => {
                            const n = Number(e.target.value.replace(/[^\d]/g, ""));
                            if (Number.isFinite(n) && n > 0 && n <= 100) setSize(n);
                        }}
                        inputMode="numeric"
                        style={{ ...input }}
                    />
                </label>
            </div>

            {loading && <div style={{ opacity: 0.8, marginTop: 8 }}>Searching…</div>}
            {err && <div style={{ color: "#ff6666", marginTop: 8 }}>{err}</div>}

            {!loading && !err && filteredResults && filteredResults.length === 0 && (
                <div style={{ opacity: 0.75, marginTop: 8 }}>
                    No IGDB-linked matches. (Custom games are excluded.)
                </div>
            )}

            {!loading && !err && filteredResults && filteredResults.length > 0 && (
                <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                    {filteredResults.map((g) => {
                        const msg = rowMsg.get(g.id) || null;
                        const busy = rowBusy === g.id;
                        return (
                            <div
                                key={g.id}
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "auto 1fr auto",
                                    gap: 12,
                                    alignItems: "center",
                                    border: "1px solid #262626",
                                    borderRadius: 10,
                                    padding: 8,
                                    background: "#0f0f0f",
                                }}
                            >
                                {/* cover with hover card */}
                                <GameHoverCard gameId={g.id}>
                                    <div style={{ display: "inline-block", flexShrink: 0 }}>
                                        <CoverThumb
                                            name={g.name}
                                            coverUrl={g.cover_url ?? undefined}
                                            width={48}
                                            height={64}
                                            rounded
                                        />
                                    </div>
                                </GameHoverCard>

                                {/* info */}
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 700 }}>{g.name}</div>
                                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                                        {toYearLabel(g.release_date)}
                                        {g.platforms?.length ? ` • ${g.platforms.map((p) => p.name).join(", ")}` : ""}
                                        {typeof g.rating === "number" ? ` • ★ ${g.rating}` : ""}
                                    </div>
                                    {msg ? (
                                        <div
                                            style={{
                                                marginTop: 6,
                                                fontSize: 13,
                                                ...(msg.updated ? successMsg : neutralMsg),
                                            }}
                                        >
                                            {msg.message}
                                        </div>
                                    ) : null}
                                </div>

                                {/* refresh action */}
                                <div>
                                    <button
                                        type="button"
                                        style={primaryBtn}
                                        onClick={() => refreshOne(g.id)}
                                        disabled={busy}
                                        aria-label={`Refresh metadata for ${g.name}`}
                                    >
                                        {busy ? "Refreshing…" : "Refresh metadata"}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Bulk actions */}
            <div
                style={{
                    marginTop: 16,
                    borderTop: "1px solid #262626",
                    paddingTop: 12,
                    display: "grid",
                    gap: 10,
                }}
            >
                <div style={{ fontWeight: 700 }}>Bulk actions</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                        type="button"
                        style={primaryBtn}
                        onClick={() => bulkRefresh("refresh_all")}
                        disabled={bulkBusy !== null}
                    >
                        {bulkBusy === "refresh_all" ? "Refreshing all…" : "Refresh all (only if outdated)"}
                    </button>
                    <button
                        type="button"
                        style={btn}
                        onClick={() => bulkRefresh("force_refresh")}
                        disabled={bulkBusy !== null}
                        title="Force refresh for all IGDB-linked games"
                    >
                        {bulkBusy === "force_refresh" ? "Forcing refresh…" : "Force refresh all"}
                    </button>
                </div>

                {/* Pretty banner for JSON responses */}
                {bulkInfo ? (
                    <div
                        role="status"
                        aria-live="polite"
                        style={{
                            marginTop: 6,
                            padding: 10,
                            background: "#0f172a",
                            border: "1px solid #1e293b",
                            borderRadius: 8,
                        }}
                    >
                        {bulkInfo.status ? (
                            <div style={{ fontWeight: 700, color: "#93c5fd" }}>
                                Status: {bulkInfo.status}
                            </div>
                        ) : null}
                        {bulkInfo.detail ? (
                            <div style={{ marginTop: 4, color: "#e5e7eb" }}>{bulkInfo.detail}</div>
                        ) : null}
                    </div>
                ) : null}

                {/* Fallback (non-JSON or unexpected shape) */}
                {bulkMsg ? (
                    <div
                        style={{
                            marginTop: 6,
                            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                            fontSize: 12,
                            whiteSpace: "pre-wrap",
                            padding: 8,
                            background: "#111",
                            border: "1px solid #262626",
                            borderRadius: 8,
                        }}
                    >
                        {bulkMsg}
                    </div>
                ) : null}

                {bulkBusy === null ? null : (
                    <div style={{ ...neutralMsg, marginTop: 2 }}>
                        This can take a while; please keep this tab open.
                    </div>
                )}
            </div>
        </div>
    );
}

/* ------------ single-select dropdown (with filter) ------------ */
function SingleSelectDropdown({
                                  label,
                                  options,
                                  value,
                                  onChange,
                                  placeholder = "Any",
                                  menuWidth = 300,
                                  maxMenuHeight = 240,
                              }: {
    label: string;
    options: Named[];
    value: string; // id as string ("" = Any)
    onChange: (next: string) => void;
    placeholder?: string;
    menuWidth?: number;
    maxMenuHeight?: number;
}) {
    const [open, setOpen] = useState(false);
    const [filter, setFilter] = useState("");
    const rootRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        function onDocClick(e: MouseEvent) {
            if (!rootRef.current) return;
            if (!rootRef.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, []);

    const base: React.CSSProperties = {
        background: "#121212",
        color: "#eaeaea",
        border: "1px solid #262626",
        borderRadius: 8,
        padding: "8px 10px",
        outline: "none",
};

    const btnStyle: React.CSSProperties = {
        ...base,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        cursor: "pointer",
        userSelect: "none",
        width: menuWidth,
    };

    const menuStyle: React.CSSProperties = {
        position: "absolute",
        zIndex: 30,
        marginTop: 6,
        background: "#0e0e0e",
        border: "1px solid #262626",
        borderRadius: 10,
        boxShadow: "0 10px 20px rgba(0,0,0,0.5)",
        minWidth: menuWidth,
        maxWidth: menuWidth,
    };

    const listWrap: React.CSSProperties = {
        maxHeight: maxMenuHeight,
        overflow: "auto",
        padding: "6px",
    };

    const row: React.CSSProperties = {
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 8px",
        borderRadius: 8,
        cursor: "pointer",
    };

    const rowActive: React.CSSProperties = {
        ...row,
        background: "#171717",
        border: "1px solid #2a2a2a",
    };

    const divider: React.CSSProperties = {
        height: 1,
        background: "#1f1f1f",
        margin: "6px 0",
    };

    const small: React.CSSProperties = { fontSize: 12, opacity: 0.75 };

    const selectedName = value
        ? options.find((o) => String(o.id) === value)?.name ?? placeholder
        : placeholder;

    const filtered = options
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .filter((o) => o.name.toLowerCase().includes(filter.toLowerCase()));

    return (
        <div ref={rootRef} style={{ position: "relative" }}>
            <div style={{ display: "grid", gap: 6 }}>
                <span style={{ opacity: 0.85, fontSize: 12 }}>{label}</span>
                <button
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    style={btnStyle}
                    aria-haspopup="listbox"
                    aria-expanded={open}
                >
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {selectedName}
          </span>
                    <span aria-hidden style={{ opacity: 0.8 }}>▾</span>
                </button>
            </div>

            {open && (
                <div style={menuStyle} role="listbox" aria-multiselectable="false">
                    <div style={{ padding: 8 }}>
                        <input
                            placeholder="Filter…"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            style={{ ...base, width: "100%" }}
                        />
                    </div>

                    <div style={listWrap}>
                        <div
                            style={value === "" ? rowActive : row}
                            onClick={() => {
                                onChange("");
                                setOpen(false);
                            }}
                            role="option"
                            aria-selected={value === ""}
                        >
                            <div>Any</div>
                            <div style={small}>Clear selection</div>
                        </div>

                        <div style={divider} />

                        {filtered.map((o) => {
                            const idStr = String(o.id);
                            const active = value === idStr;
                            return (
                                <div
                                    key={o.id}
                                    style={active ? rowActive : row}
                                    onClick={() => {
                                        onChange(idStr);
                                        setOpen(false);
                                    }}
                                    role="option"
                                    aria-selected={active}
                                >
                                    <div>{o.name}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
