"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type IGDBSearchItem = {
    id: number;
    name: string;
    release_date?: number | null;
    cover_url?: string | null;
    platforms?: Array<{ id: number; name: string }>;
};

type IGDBGame = {
    id: number;
    name: string;
    cover_url?: string | null;
    release_date?: number | null;
    platforms?: Array<{ id: number; name: string }>;
    summary?: string | null;
    game_modes?: Array<{ id: number; name: string }>;
    genres?: Array<{ id: number; name: string }>;
    rating?: number | null;
    updated_at?: number;
    companies?: Array<{
        company_id: number;
        name: string;
        developer?: boolean;
        publisher?: boolean;
        porting?: boolean;
        supporting?: boolean;
    }>;
    collection?: { id: number; name: string } | null;
    igdb_tags?: Array<{ id: number; name: string }>;
};

function yearLabel(n?: number | null) {
    if (n == null) return "—";
    if (n >= 1000 && n <= 3000) return String(n);
    if (n >= 1_000_000_000_000) return String(new Date(n).getUTCFullYear()); // ms
    if (n >= 1_000_000_000) return String(new Date(n * 1000).getUTCFullYear()); // sec
    return String(n);
}

export default function AddFromIGDB() {
    const [q, setQ] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [results, setResults] = useState<IGDBSearchItem[]>([]);
    const [error, setError] = useState<string | null>(null);

    const [openId, setOpenId] = useState<number | null>(null);
    const [detail, setDetail] = useState<IGDBGame | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState<string | null>(null);

    const listRef = useRef<HTMLUListElement | null>(null);

    async function runSearch() {
        const term = q.trim();
        if (!term) {
            setResults([]);
            setError(null);
            return;
        }
        setIsSearching(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/igdb/search?q=${encodeURIComponent(term)}`, { cache: "no-store" });
            if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
            const arr = (await res.json()) as IGDBSearchItem[] | { results?: IGDBSearchItem[] };
            const list = Array.isArray(arr) ? arr : (arr?.results ?? []);
            setResults(Array.isArray(list) ? list : []);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Search failed");
            setResults([]);
        } finally {
            setIsSearching(false);
        }
    }

    async function openDrawer(id: number) {
        setOpenId(id);
        setDetail(null);
        setDetailError(null);
        setDetailLoading(true);
        try {
            const res = await fetch(`/api/admin/igdb/game/${id}`, { cache: "no-store" });
            if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
            const data = (await res.json()) as IGDBGame;
            setDetail(data);
        } catch (e) {
            setDetailError(e instanceof Error ? e.message : "Failed to load game details");
        } finally {
            setDetailLoading(false);
        }
    }

    const hasResults = results.length > 0;

    return (
        <div>
            {/* Search box */}
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    void runSearch();
                }}
                style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}
            >
                <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search IGDB…"
                    style={input}
                />
                <button type="submit" disabled={!q.trim() || isSearching} style={btnPrimary}>
                    {isSearching ? "Searching…" : "Search"}
                </button>
            </form>

            {error ? (
                <div style={errorBox}>Search failed. <span style={{ opacity: 0.8 }}>{error}</span></div>
            ) : null}

            {/* Results */}
            <ul ref={listRef} style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {hasResults
                    ? results.map((g) => (
                        <li
                            key={g.id}
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1fr auto",
                                gap: 8,
                                padding: "10px 8px",
                                borderTop: "1px solid #1f1f1f",
                                alignItems: "center",
                            }}
                        >
                            <div>
                                <div style={{ fontWeight: 600 }}>{g.name}</div>
                                <div style={{ fontSize: 12, opacity: 0.75 }}>
                                    {yearLabel(g.release_date)} · {(g.platforms ?? []).map((p) => p.name).join(", ") || "—"}
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                                <button type="button" onClick={() => openDrawer(g.id)} style={btnGhost}>
                                    View
                                </button>
                            </div>
                        </li>
                    ))
                    : q && !isSearching && !error
                        ? <li style={{ padding: "8px 0", opacity: 0.75 }}>No results.</li>
                        : null}
            </ul>

            {/* Drawer */}
            <Drawer open={openId != null} onClose={() => setOpenId(null)}>
                {detailLoading ? (
                    <div style={{ padding: 16, opacity: 0.85 }}>Loading…</div>
                ) : detailError ? (
                    <div style={{ padding: 16, color: "#fca5a5" }}>Failed to load. {detailError}</div>
                ) : detail ? (
                    <IGDBGameView game={detail} />
                ) : null}
            </Drawer>
        </div>
    );
}

/* ---------------- Drawer + Detail View ---------------- */

function Drawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
    return (
        <>
            {/* Scrim */}
            <div
                onClick={onClose}
                style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.5)",
                    opacity: open ? 1 : 0,
                    pointerEvents: open ? "auto" : "none",
                    transition: "opacity 150ms ease",
                    zIndex: 80,
                }}
            />
            {/* Panel */}
            <aside
                role="dialog"
                aria-modal
                style={{
                    position: "fixed",
                    top: 0,
                    right: 0,
                    height: "100dvh",
                    width: "min(640px, 92vw)",
                    background: "#0f0f0f",
                    borderLeft: "1px solid #1f1f1f",
                    boxShadow: "0 0 40px rgba(0,0,0,0.4)",
                    transform: open ? "translateX(0)" : "translateX(100%)",
                    transition: "transform 180ms ease",
                    zIndex: 90,
                    display: "grid",
                    gridTemplateRows: "auto 1fr",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 12, borderBottom: "1px solid #1f1f1f" }}>
                    <div style={{ fontWeight: 700 }}>IGDB Game</div>
                    <button type="button" onClick={onClose} style={btnGhost}>Close</button>
                </div>
                <div style={{ overflow: "auto" }}>{children}</div>
            </aside>
        </>
    );
}

function IGDBGameView({ game }: { game: IGDBGame }) {
    return (
        <div style={{ padding: 16, display: "grid", gap: 12 }}>
            {/* Header */}
            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 12 }}>
                <div
                    style={{
                        width: 120,
                        height: 120,
                        background: "#151515",
                        border: "1px solid #262626",
                        borderRadius: 10,
                        overflow: "hidden",
                        display: "grid",
                        placeItems: "center",
                    }}
                >
                    {game.cover_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={game.cover_url}
                            alt={game.name}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                    ) : (
                        <div style={{ fontSize: 12, opacity: 0.6 }}>No cover</div>
                    )}
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{game.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                        {yearLabel(game.release_date)} · {(game.platforms ?? []).map((p) => p.name).join(", ") || "—"}
                    </div>
                    {typeof game.rating === "number" ? (
                        <div style={{ fontSize: 12, opacity: 0.85 }}>Rating: {game.rating}</div>
                    ) : null}
                </div>
            </div>

            {/* Summary */}
            {game.summary ? (
                <div style={{ background: "#111", border: "1px solid #262626", borderRadius: 10, padding: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Summary</div>
                    <div style={{ opacity: 0.9, lineHeight: 1.5 }}>{game.summary}</div>
                </div>
            ) : null}

            {/* Meta grids */}
            <TwoCol title="Genres" items={(game.genres ?? []).map((x) => x.name)} />
            <TwoCol title="Modes" items={(game.game_modes ?? []).map((x) => x.name)} />
            <TwoCol title="IGDB Tags" items={(game.igdb_tags ?? []).map((x) => x.name)} />
            <TwoCol title="Companies" items={(game.companies ?? []).map((c) => {
                const roles: string[] = [];
                if (c.developer) roles.push("dev");
                if (c.publisher) roles.push("pub");
                if (c.porting) roles.push("port");
                if (c.supporting) roles.push("support");
                return roles.length ? `${c.name} (${roles.join(", ")})` : c.name;
            })} />
            {game.collection ? (
                <TwoCol title="Collection" items={[game.collection.name]} />
            ) : null}
        </div>
    );
}

function TwoCol({ title, items }: { title: string; items: string[] }) {
    if (!items.length) return null;
    return (
        <div style={{ background: "#111", border: "1px solid #262626", borderRadius: 10, padding: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{title}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {items.map((t, i) => (
                    <span
                        key={`${title}-${i}-${t}`}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            background: "#1e1e1e",
                            border: "1px solid #2b2b2b",
                            borderRadius: 999,
                            padding: "4px 8px",
                            fontSize: 12,
                        }}
                    >
            {t}
          </span>
                ))}
            </div>
        </div>
    );
}

/* ---------------- styles ---------------- */

const input: React.CSSProperties = {
    background: "#1a1a1a",
    color: "#eaeaea",
    border: "1px solid #2b2b2b",
    borderRadius: 8,
    padding: "10px 12px",
    outline: "none",
    minWidth: 280,
};

const btnPrimary: React.CSSProperties = {
    background: "#1e293b",
    color: "#fff",
    border: "1px solid #3b82f6",
    borderRadius: 8,
    padding: "10px 14px",
    fontWeight: 600,
    cursor: "pointer",
};

const btnGhost: React.CSSProperties = {
    background: "#151515",
    color: "#eaeaea",
    border: "1px solid #2b2b2b",
    borderRadius: 8,
    padding: "8px 12px",
    cursor: "pointer",
};

const errorBox: React.CSSProperties = {
    background: "#3b0f12",
    border: "1px solid #5b1a1f",
    color: "#ffd7d7",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
};
