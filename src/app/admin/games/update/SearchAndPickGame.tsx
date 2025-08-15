"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
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
        width: menuWidth, // keep the trigger narrower so it doesn’t collide with Year
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

/* ------------ component ------------ */
export default function SearchAndPickGame({
                                              initialPlatforms,
                                          }: {
    initialPlatforms: Named[];
}) {
    // Filters (Basic Search — single platform)
    const [q, setQ] = useState("");
    const [year, setYear] = useState("");
    const [platformId, setPlatformId] = useState<string>(""); // SINGLE
    const [tagCsv, setTagCsv] = useState(""); // synced from hidden input rendered by TagChipsAutocomplete
    const [matchMode, setMatchMode] = useState<"any" | "all" | "exact">("any");
    const [size, setSize] = useState(20);

    // Data
    const [platforms] = useState<Named[]>(Array.isArray(initialPlatforms) ? initialPlatforms : []);
    const [results, setResults] = useState<GameListItem[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

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
    }, [tagsHostRef.current]);

    // Reset everything (including TagChipsAutocomplete hidden input)
    function resetAll() {
        setQ("");
        setYear("");
        setPlatformId("");
        setMatchMode("any");
        setSize(20);
        setTagCsv("");
        const host = tagsHostRef.current;
        const input = host?.querySelector('input[name="tag_ids"]') as HTMLInputElement | null;
        if (input) {
            input.value = "";
            // notify the component that value changed
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
    };

    const ghostBtn: React.CSSProperties = {
        ...btn,
        background: "#151515",
        border: "1px solid #2b2b2b",
        color: "#d8d8d8",
    };

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
                        options={platforms}
                        value={platformId}
                        onChange={setPlatformId}
                        placeholder="Any"
                        menuWidth={300}
                    />
                </div>

                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 160px" }}>
                    {/* Tags — uses existing component; we read its hidden input value */}
                    <div ref={tagsHostRef}>
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

                {/* Reset row */}
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
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
                            {/* cover with hover card (same behavior as site search) */}
                            <GameHoverCard gameId={g.id}>
                                <Link href={`/games/${g.id}`} style={{ display: "inline-block", flexShrink: 0 }}>
                                    <CoverThumb
                                        name={g.name}
                                        coverUrl={g.cover_url ?? undefined}
                                        width={48}
                                        height={64}
                                        rounded
                                    />
                                </Link>
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

                            {/* open */}
                            <Link
                                href={`/admin/games/update/${g.id}`}
                                style={Object.assign({}, input, { textDecoration: "none" })}
                            >
                                Open Editor
                            </Link>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
