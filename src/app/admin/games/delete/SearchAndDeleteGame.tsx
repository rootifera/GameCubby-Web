"use client";

import React, { useEffect, useRef, useState } from "react";
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

type LocationPathItem = { id: number; name: string };
type GameDetails = {
    id: number;
    name: string;
    cover_url?: string | null;
    condition?: number | null;
    order?: number | null;
    location_path?: LocationPathItem[] | null;
};

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

function joinLocationPath(path?: LocationPathItem[] | null): string {
    if (!Array.isArray(path) || path.length === 0) return "—";
    return path.map((p) => p.name).join(" > ");
}

/* ------------ confirm modal ------------ */
function ConfirmDeleteModal({
                                open,
                                details,
                                onCancel,
                                onConfirm,
                                busy,
                                error,
                            }: {
    open: boolean;
    details?: GameDetails | null;
    onCancel: () => void;
    onConfirm: () => void;
    busy: boolean;
    error: string | null;
}) {
    if (!open) return null;

    const overlay: React.CSSProperties = {
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "grid",
        placeItems: "center",
        zIndex: 1000,
    };
    const card: React.CSSProperties = {
        background: "#0f0f0f",
        border: "1px solid #262626", // ← fixed quoting
        borderRadius: 12,
        padding: 16,
        width: "min(640px, 96vw)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
    };
    const title: React.CSSProperties = { fontWeight: 800, fontSize: 18, marginBottom: 12 };
    const row: React.CSSProperties = { display: "grid", gridTemplateColumns: "96px 1fr", gap: 12 };
    const dangerBtn: React.CSSProperties = {
        background: "#2a0f0f",
        color: "#fca5a5",
        border: "1px solid #7f1d1d",
        borderRadius: 8,
        padding: "8px 12px",
        cursor: busy ? "not-allowed" : "pointer",
        opacity: busy ? 0.6 : 1,
    };
    const neutralBtn: React.CSSProperties = {
        background: "#1b1b1b",
        color: "#eaeaea",
        border: "1px solid #2e2e2e",
        borderRadius: 8,
        padding: "8px 12px",
        cursor: busy ? "not-allowed" : "pointer",
        opacity: busy ? 0.6 : 1,
    };

    return (
        <div style={overlay} role="dialog" aria-modal="true" aria-labelledby="del_title">
            <div style={card}>
                <div id="del_title" style={title}>Delete game?</div>

                <div style={row}>
                    {/* cover */}
                    <div>
                        <CoverThumb
                            name={details?.name ?? "Game"}
                            coverUrl={details?.cover_url ?? undefined}
                            width={96}
                            height={128}
                            rounded
                        />
                    </div>

                    {/* info */}
                    <div style={{ display: "grid", gap: 6, alignContent: "start" }}>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>{details?.name ?? "—"}</div>
                        <div style={{ fontSize: 13, opacity: 0.85 }}>
                            <div><span style={{ opacity: 0.8 }}>Location:</span> {joinLocationPath(details?.location_path)}</div>
                            <div><span style={{ opacity: 0.8 }}>Order:</span> {details?.order ?? "—"}</div>
                            <div><span style={{ opacity: 0.8 }}>Condition:</span> {details?.condition ?? "—"}</div>
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                            This action is permanent. You can’t undo this.
                        </div>
                    </div>
                </div>

                {error ? <div style={{ color: "#fca5a5", marginTop: 10 }}>{error}</div> : null}

                <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
                    <button type="button" style={neutralBtn} onClick={onCancel} disabled={busy}>
                        No, keep it
                    </button>
                    <button type="button" style={dangerBtn} onClick={onConfirm} disabled={busy}>
                        {busy ? "Deleting…" : "Yes, delete"}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ------------ page component ------------ */
export default function SearchAndDeleteGame({ initialPlatforms }: { initialPlatforms: Named[] }) {
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

    // Delete flow
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmBusy, setConfirmBusy] = useState(false);
    const [confirmErr, setConfirmErr] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [selectedDetails, setSelectedDetails] = useState<GameDetails | null>(null);
    const [selectedName, setSelectedName] = useState<string>(""); // for nicer banner
    const [banner, setBanner] = useState<string | null>(null);

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

    // Reset everything (including Tags) — remount the tags widget
    function resetAll() {
        setQ("");
        setYear("");
        setPlatformId("");
        setMatchMode("any");
        setSize(20);
        setTagCsv("");
        setResults(null);
        setErr(null);
        setBanner(null);
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
            setBanner(null);
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

    const dangerBtn: React.CSSProperties = {
        ...btn,
        background: "#2a0f0f",
        border: "1px solid #7f1d1d",
        color: "#fca5a5",
    };

    // --- delete handlers ---
    async function openDeleteFor(id: number, fallback: GameListItem) {
        setConfirmErr(null);
        setSelectedId(id);
        setSelectedName(fallback.name); // banner fallback
        setConfirmBusy(false);
        setConfirmOpen(true);

        // Fetch details to display location/order/condition (and nicer name if available)
        try {
            const res = await fetch(`/api/proxy/games/${id}`, { cache: "no-store" });
            if (!res.ok) throw new Error(`GET /api/proxy/games/${id} -> ${res.status}`);
            const data = (await res.json()) as GameDetails;
            const name = data?.name ?? fallback.name;
            setSelectedName(name);
            setSelectedDetails({
                id,
                name,
                cover_url: data?.cover_url ?? fallback.cover_url,
                condition: data?.condition ?? null,
                order: data?.order ?? null,
                location_path: Array.isArray(data?.location_path) ? data.location_path : null,
            });
        } catch {
            // Fall back if details fetch fails
            setSelectedDetails({
                id,
                name: fallback.name,
                cover_url: fallback.cover_url,
                condition: null,
                order: null,
                location_path: null,
            });
        }
    }

    function closeConfirm() {
        setConfirmOpen(false);
        setConfirmBusy(false);
        setConfirmErr(null);
        setSelectedId(null);
        setSelectedDetails(null);
    }

    async function confirmDelete() {
        if (!selectedId) return;
        setConfirmBusy(true);
        setConfirmErr(null);
        try {
            const res = await fetch(`/api/admin/games/${selectedId}`, {
                method: "DELETE",
                headers: { Accept: "application/json" },
            });
            if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(`DELETE failed (${res.status}) ${text}`);
            }

            // Remove from the list locally and show a helpful banner with the game's name.
            setResults((prev) => (Array.isArray(prev) ? prev.filter((g) => g.id !== selectedId) : prev));
            setBanner(`Deleted “${selectedName}”.`);
            closeConfirm();
        } catch (e: any) {
            setConfirmErr(e?.message ?? "Failed to delete");
            setConfirmBusy(false);
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
                            placeholder="1998"
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
                        <TagChipsAutocomplete
                            label="Tags"
                            name="tag_ids"
                            suggestKind="tags"
                            defaultSelectedIds={[]}
                        />
                    </div>

                    <label style={{ display: "grid", gap: 6 }}>
                        <span style={{ opacity: 0.85, fontSize: 12 }}>Tag match</span>
                        <select
                            value={matchMode}
                            onChange={(e) =>
                                setMatchMode((e.target.value as "any" | "all" | "exact") ?? "any")
                            }
                            style={{ ...input }}
                        >
                            <option value="any">Any</option>
                            <option value="all">All</option>
                            <option value="exact">Exact</option>
                        </select>
                    </label>
                </div>

                {/* Reset row + banner */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    {banner ? <div style={{ color: "#86efac" }}>{banner}</div> : <div />}
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

            {!loading && !err && results && results.length === 0 && (
                <div style={{ opacity: 0.75, marginTop: 8 }}>No matches.</div>
            )}

            {!loading && !err && results && results.length > 0 && (
                <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                    {results.map((g) => (
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
                            {/* cover WITH HOVER INFO (GameHoverCard) */}
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
                            </div>

                            {/* delete action */}
                            <div>
                                <button
                                    type="button"
                                    style={dangerBtn}
                                    onClick={() => openDeleteFor(g.id, g)}
                                    aria-label={`Delete ${g.name}`}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Confirmation modal */}
            <ConfirmDeleteModal
                open={confirmOpen}
                details={selectedDetails}
                onCancel={closeConfirm}
                onConfirm={confirmDelete}
                busy={confirmBusy}
                error={confirmErr}
            />
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
    const rootRef = useRef<HTMLDivElement | null>(null); // ← removed stray control char

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
