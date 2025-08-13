"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import LocationTreePicker from "@/components/LocationTreePicker";
import TagChipsAutocomplete from "@/components/TagChipsAutocomplete";

/* ---------- Types from IGDB endpoints ---------- */
type IgdbSearchItem = {
    id: number;
    name: string;
    cover_url?: string | null;
    release_date?: number | null;
    summary?: string | null;
    platforms?: Array<{ id: number; name: string }>;
};

type IgdbGameDetails = {
    id: number;
    name: string;
    cover_url?: string | null;
    release_date?: number | null;
    platforms?: Array<{ id: number; name: string }>;
    summary?: string | null;
    game_modes?: Array<{ id: number; name: string }>;
    genres?: Array<{ id: number; name: string }>;
    rating?: number | null;
    updated_at?: number | null;
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

/* ---------- Helpers ---------- */
function toYear(n?: number | null): string {
    if (n == null) return "";
    if (n >= 1000 && n <= 3000) return String(n);
    if (n >= 1_000_000_000_000) return String(new Date(n).getUTCFullYear());
    if (n >= 1_000_000_000) return String(new Date(n * 1000).getUTCFullYear());
    return String(n);
}
function parseIdsCSV(csv: string | null | undefined): number[] {
    if (!csv) return [];
    return csv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => Number(s))
        .filter((n) => Number.isFinite(n) && n > 0);
}

/* ================================================================== */

export default function AdminAddGamePage() {
    /* ---- search state ---- */
    const [q, setQ] = useState("");
    const [hasSearched, setHasSearched] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<IgdbSearchItem[]>([]);

    /* ---- details overlay state ---- */
    const [openId, setOpenId] = useState<number | null>(null);
    const [details, setDetails] = useState<IgdbGameDetails | null>(null);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [detailsError, setDetailsError] = useState<string | null>(null);

    /* ---- add form state (inside overlay) ---- */
    const formRef = useRef<HTMLFormElement | null>(null);
    const [saving, setSaving] = useState(false);
    const [savedMsg, setSavedMsg] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);

    // platforms from details; user can tick multiple
    const [selectedPlatforms, setSelectedPlatforms] = useState<Set<number>>(new Set());
    // Local mirrors for condition/order so we can package JSON easily
    const [condition, setCondition] = useState<number>(0);
    const [order, setOrder] = useState<number>(0);

    /* ---------------- Search ---------------- */
    async function doSearch(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const query = q.trim();
        if (!query) {
            setResults([]);
            setError(null);
            setHasSearched(false);
            return;
        }
        setLoading(true);
        setError(null);
        setHasSearched(true); // mark that user initiated a search
        try {
            // Protected admin proxy (reads gc_at cookie)
            const res = await fetch(`/api/admin/igdb/search?q=${encodeURIComponent(query)}`, {
                cache: "no-store",
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || `${res.status} ${res.statusText}`);
            }
            const arr = (await res.json()) as IgdbSearchItem[] | { results?: IgdbSearchItem[] };
            const list = Array.isArray(arr) ? arr : Array.isArray(arr?.results) ? arr.results : [];
            setResults(list);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Search failed");
            setResults([]);
        } finally {
            setLoading(false);
        }
    }

    /* ---------------- Details overlay ---------------- */
    function openDetails(id: number) {
        setOpenId(id);
        setDetails(null);
        setDetailsError(null);
        setDetailsLoading(true);
        setSaving(false);
        setSavedMsg(null);
        setSaveError(null);
        setSelectedPlatforms(new Set());
        setCondition(0);
        setOrder(0);
        void (async () => {
            try {
                const res = await fetch(`/api/admin/igdb/game/${id}`, { cache: "no-store" });
                if (!res.ok) {
                    const t = await res.text();
                    throw new Error(t || `${res.status} ${res.statusText}`);
                }
                const data = (await res.json()) as IgdbGameDetails;
                setDetails(data);
            } catch (e) {
                setDetailsError(e instanceof Error ? e.message : "Failed to load details");
            } finally {
                setDetailsLoading(false);
            }
        })();
    }
    function closeDetails() {
        setOpenId(null);
        setDetails(null);
        setDetailsError(null);
        setDetailsLoading(false);
        setSaving(false);
        setSavedMsg(null);
        setSaveError(null);
        setSelectedPlatforms(new Set());
    }

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape" && openId != null) closeDetails();
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [openId]);

    const headerNote = useMemo(() => {
        if (loading) return "Searching…";
        if (error) return "Search failed";
        if (!hasSearched) return ""; // show nothing until user clicks Search
        return results.length ? `Found ${results.length} result${results.length === 1 ? "" : "s"}` : "No results";
    }, [loading, error, results.length, hasSearched]);

    /* ---------------- Add form submit ---------------- */
    async function onAddSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!details) return;
        setSaving(true);
        setSaveError(null);
        setSavedMsg(null);

        // Read values from the form (for components that write hidden inputs)
        const fd = new FormData(formRef.current!);
        const location_id = Number(fd.get("location_id") || 0) || 0;
        const tagCSV = String(fd.get("tag_ids") || "");
        const tag_ids = parseIdsCSV(tagCSV);

        const payload = {
            igdb_id: Number(details.id),
            platform_ids: Array.from(selectedPlatforms),
            location_id,
            tag_ids,
            condition: Number(condition) || 0,
            order: Number(order) || 0,
        };

        try {
            // Internal admin proxy (forwards with cookie bearer)
            const res = await fetch("/api/admin/games/from_igdb", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                let msg = `${res.status} ${res.statusText}`;
                try {
                    const t = await res.text();
                    if (t) msg = t;
                } catch {}
                throw new Error(msg);
            }

            setSavedMsg("Saved!");
            // brief confirmation then close to keep search results intact
            setTimeout(() => {
                closeDetails();
            }, 900);
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : "Failed to save");
        } finally {
            setSaving(false);
        }
    }

    /* ================================================================== */

    return (
        <div style={{ padding: 16 }}>
            {/* Breadcrumb */}
            <div style={{ marginBottom: 12 }}>
                <Link href={{ pathname: "/admin" }} style={{ color: "#a0c4ff", textDecoration: "none" }}>
                    ← Admin
                </Link>
            </div>

            <h1 style={{ fontSize: 24, margin: "0 0 8px 0" }}>Add Game (IGDB)</h1>

            {/* Search bar */}
            <form
                onSubmit={doSearch}
                style={{ display: "flex", gap: 8, marginBottom: 12, maxWidth: 600 }}
            >
                <input
                    value={q}
                    onChange={(e) => {
                        setQ(e.target.value);
                        setHasSearched(false); // typing again hides status until next search
                        setError(null);
                    }}
                    placeholder="Search IGDB titles… (e.g., Age of Empires)"
                    autoFocus
                    style={{
                        flex: 1,
                        background: "#1a1a1a",
                        color: "#eaeaea",
                        border: "1px solid #2b2b2b",
                        borderRadius: 8,
                        padding: "10px 12px",
                        outline: "none",
                    }}
                />
                <button
                    type="submit"
                    disabled={loading}
                    style={{
                        background: "#1e293b",
                        color: "#fff",
                        border: "1px solid #3b82f6",
                        borderRadius: 8,
                        padding: "10px 14px",
                        fontWeight: 600,
                        cursor: loading ? "default" : "pointer",
                        opacity: loading ? 0.7 : 1,
                    }}
                >
                    Search
                </button>
            </form>

            {/* Status / errors */}
            {headerNote ? (
                <div style={{ opacity: 0.8, marginBottom: 8, fontSize: 13 }}>{headerNote}</div>
            ) : null}
            {error ? (
                <div
                    style={{
                        background: "#3b0f12",
                        border: "1px solid #5b1a1f",
                        color: "#ffd7d7",
                        padding: 12,
                        borderRadius: 8,
                        marginBottom: 12,
                        maxWidth: 700,
                    }}
                >
                    {error}
                </div>
            ) : null}

            {/* Results list */}
            {results.length > 0 ? (
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
                    {results.map((g) => (
                        <li
                            key={g.id}
                            style={{
                                display: "grid",
                                gridTemplateColumns: "72px 1fr auto",
                                gap: 12,
                                alignItems: "center",
                                background: "#111",
                                border: "1px solid #262626",
                                borderRadius: 10,
                                padding: 8,
                            }}
                        >
                            {/* Cover (clickable) */}
                            <div
                                onClick={() => openDetails(g.id)}
                                role="button"
                                title="View details"
                                style={{
                                    width: 72,
                                    height: 96,
                                    background: "#1a1a1a",
                                    border: "1px solid #2b2b2b",
                                    borderRadius: 6,
                                    overflow: "hidden",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor: "pointer",
                                }}
                            >
                                {g.cover_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={g.cover_url}
                                        alt={g.name}
                                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                    />
                                ) : (
                                    <span style={{ opacity: 0.6, fontSize: 12 }}>No cover</span>
                                )}
                            </div>

                            {/* Info (name clickable) */}
                            <div style={{ minWidth: 0 }}>
                                <button
                                    type="button"
                                    onClick={() => openDetails(g.id)}
                                    title="View details"
                                    style={{
                                        all: "unset",
                                        cursor: "pointer",
                                        fontWeight: 600,
                                        color: "#fff",
                                    }}
                                >
                                    {g.name}{" "}
                                    <span style={{ opacity: 0.7, fontWeight: 400 }}>
                    {typeof g.release_date === "number" ? `(${toYear(g.release_date)})` : ""}
                  </span>
                                </button>

                                <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
                                    {(g.platforms ?? []).map((p) => p.name).join(", ") || "—"}
                                </div>
                                {g.summary ? (
                                    <div
                                        style={{
                                            fontSize: 12,
                                            opacity: 0.7,
                                            marginTop: 6,
                                            display: "-webkit-box",
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: "vertical",
                                            overflow: "hidden",
                                        }}
                                    >
                                        {g.summary}
                                    </div>
                                ) : null}
                            </div>

                            {/* View -> opens overlay */}
                            <div>
                                <button
                                    type="button"
                                    title="View details"
                                    style={{
                                        background: "#151515",
                                        color: "#eaeaea",
                                        border: "1px solid #2b2b2b",
                                        borderRadius: 8,
                                        padding: "8px 12px",
                                        cursor: "pointer",
                                    }}
                                    onClick={() => openDetails(g.id)}
                                >
                                    View
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : null}

            {/* Details Overlay */}
            {openId != null ? (
                <div
                    role="dialog"
                    aria-modal="true"
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0,0,0,0.6)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 16,
                        zIndex: 100,
                    }}
                    onClick={closeDetails}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: "min(960px, 96vw)",
                            maxHeight: "90vh",
                            overflow: "auto",
                            background: "#0f0f10",
                            border: "1px solid #262626",
                            borderRadius: 12,
                            padding: 16,
                        }}
                    >
                        {/* Titlebar */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
                            <h2 style={{ margin: 0, fontSize: 20 }}>
                                {details?.name || "Loading…"}
                                {typeof details?.release_date === "number" ? (
                                    <span style={{ opacity: 0.7, fontWeight: 400 }}> ({toYear(details.release_date)})</span>
                                ) : null}
                            </h2>
                            <button
                                type="button"
                                onClick={closeDetails}
                                style={{
                                    background: "#151515",
                                    color: "#eaeaea",
                                    border: "1px solid #2b2b2b",
                                    borderRadius: 8,
                                    padding: "6px 10px",
                                    cursor: "pointer",
                                }}
                            >
                                Close
                            </button>
                        </div>

                        {/* States */}
                        {detailsLoading ? (
                            <div style={{ opacity: 0.8, marginTop: 8 }}>Loading details…</div>
                        ) : detailsError ? (
                            <div
                                style={{
                                    background: "#3b0f12",
                                    border: "1px solid #5b1a1f",
                                    color: "#ffd7d7",
                                    padding: 12,
                                    borderRadius: 8,
                                    marginTop: 12,
                                }}
                            >
                                {detailsError}
                            </div>
                        ) : details ? (
                            <>
                                {/* Info grid */}
                                <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 16, marginTop: 12 }}>
                                    {/* Cover */}
                                    <div
                                        style={{
                                            width: 180,
                                            height: 220,
                                            background: "#1a1a1a",
                                            border: "1px solid #2b2b2b",
                                            borderRadius: 8,
                                            overflow: "hidden",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        {details.cover_url ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={details.cover_url}
                                                alt={details.name}
                                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                            />
                                        ) : (
                                            <span style={{ opacity: 0.6, fontSize: 12 }}>No cover</span>
                                        )}
                                    </div>

                                    {/* Read-only facts */}
                                    <div style={{ display: "grid", gap: 10 }}>
                                        {details.summary ? (
                                            <p style={{ margin: 0, lineHeight: 1.5, whiteSpace: "pre-wrap", opacity: 0.95 }}>
                                                {details.summary}
                                            </p>
                                        ) : null}

                                        <Row label="Platforms">
                                            {(details.platforms ?? []).map((p) => p.name).join(", ") || "—"}
                                        </Row>
                                        <Row label="Genres">{(details.genres ?? []).map((g) => g.name).join(", ") || "—"}</Row>
                                        <Row label="Modes">{(details.game_modes ?? []).map((m) => m.name).join(", ") || "—"}</Row>
                                        <Row label="Rating">{details.rating ?? "—"}</Row>
                                        <Row label="Collection">{details.collection?.name ?? "—"}</Row>
                                        <Row label="Companies">
                                            {(details.companies ?? [])
                                                .map((c) => {
                                                    const roles = [
                                                        c.developer ? "dev" : null,
                                                        c.publisher ? "pub" : null,
                                                        c.porting ? "port" : null,
                                                        c.supporting ? "support" : null,
                                                    ].filter(Boolean);
                                                    return `${c.name}${roles.length ? ` (${roles.join(",")})` : ""}`;
                                                })
                                                .join(", ") || "—"}
                                        </Row>
                                        <Row label="Tags">{(details.igdb_tags ?? []).map((t) => t.name).join(", ") || "—"}</Row>
                                    </div>
                                </div>

                                {/* Divider */}
                                <div style={{ height: 1, background: "#1f1f1f", margin: "14px 0" }} />

                                {/* Add form */}
                                <form ref={formRef} onSubmit={onAddSubmit} style={{ display: "grid", gap: 12 }}>
                                    {/* Hidden igdb_id for clarity (we still pack JSON manually) */}
                                    <input type="hidden" name="igdb_id" value={details.id} />

                                    {/* Platforms (from details) */}
                                    <div>
                                        <div style={{ fontWeight: 600, marginBottom: 6 }}>Select your platform(s)</div>
                                        {details.platforms?.length ? (
                                            <div style={{ display: "grid", gap: 6 }}>
                                                {details.platforms.map((p) => {
                                                    const checked = selectedPlatforms.has(p.id);
                                                    return (
                                                        <label
                                                            key={p.id}
                                                            style={{
                                                                display: "flex",
                                                                alignItems: "center",
                                                                gap: 8,
                                                                padding: "6px 8px",
                                                                borderRadius: 6,
                                                                background: checked ? "#1e293b" : "transparent",
                                                                border: checked ? "1px solid #334155" : "1px solid transparent",
                                                            }}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={() =>
                                                                    setSelectedPlatforms((prev) => {
                                                                        const next = new Set(prev);
                                                                        if (next.has(p.id)) next.delete(p.id);
                                                                        else next.add(p.id);
                                                                        return next;
                                                                    })
                                                                }
                                                                style={{ accentColor: "#3b82f6" }}
                                                            />
                                                            <span>{p.name}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div style={{ opacity: 0.7 }}>No platform data from IGDB.</div>
                                        )}
                                    </div>

                                    {/* Location (tree picker writes hidden input name="location_id") */}
                                    <LocationTreePicker label="Location" name="location_id" />

                                    {/* User Tags (chips with suggestions -> writes hidden input name="tag_ids" = CSV) */}
                                    <TagChipsAutocomplete label="Tags" name="tag_ids" suggestKind="tags" />

                                    {/* Condition & Order */}
                                    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "200px 200px" }}>
                                        <label style={{ display: "grid", gap: 6 }}>
                                            <span style={{ opacity: 0.85 }}>Condition (0–10)</span>
                                            <select
                                                value={condition}
                                                onChange={(e) => setCondition(Number(e.target.value) || 0)}
                                                style={selectStyle}
                                            >
                                                {Array.from({ length: 11 }, (_, i) => i).map((n) => (
                                                    <option key={n} value={n}>
                                                        {n}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>

                                        <label style={{ display: "grid", gap: 6 }}>
                                            <span style={{ opacity: 0.85 }}>Order</span>
                                            <input
                                                type="number"
                                                inputMode="numeric"
                                                value={order}
                                                onChange={(e) => setOrder(Number(e.target.value) || 0)}
                                                style={inputStyle}
                                                placeholder="0"
                                            />
                                        </label>
                                    </div>

                                    {/* Save / status */}
                                    {saveError ? (
                                        <div
                                            style={{
                                                background: "#3b0f12",
                                                border: "1px solid #5b1a1f",
                                                color: "#ffd7d7",
                                                padding: 10,
                                                borderRadius: 8,
                                            }}
                                        >
                                            {saveError}
                                        </div>
                                    ) : null}
                                    {savedMsg ? (
                                        <div
                                            style={{
                                                background: "#16321f",
                                                border: "1px solid #1d5f38",
                                                color: "#c9f7d2",
                                                padding: 10,
                                                borderRadius: 8,
                                            }}
                                        >
                                            {savedMsg}
                                        </div>
                                    ) : null}

                                    <div style={{ display: "flex", gap: 8 }}>
                                        <button
                                            type="submit"
                                            disabled={saving}
                                            style={{
                                                background: "#1e293b",
                                                color: "#fff",
                                                border: "1px solid #3b82f6",
                                                borderRadius: 8,
                                                padding: "10px 14px",
                                                fontWeight: 600,
                                                cursor: saving ? "default" : "pointer",
                                                opacity: saving ? 0.7 : 1,
                                            }}
                                        >
                                            {saving ? "Saving…" : "Add from IGDB"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={closeDetails}
                                            style={{
                                                background: "#151515",
                                                color: "#eaeaea",
                                                border: "1px solid #2b2b2b",
                                                borderRadius: 8,
                                                padding: "10px 14px",
                                                cursor: "pointer",
                                            }}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            </>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </div>
    );
}

/* ---------- Small bits ---------- */

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 10 }}>
            <div style={{ opacity: 0.75 }}>{label}</div>
            <div>{children}</div>
        </div>
    );
}

const selectStyle: React.CSSProperties = {
    background: "#1a1a1a",
    color: "#eaeaea",
    border: "1px solid #2b2b2b",
    borderRadius: 8,
    padding: "10px 12px",
    outline: "none",
};

const inputStyle: React.CSSProperties = {
    background: "#1a1a1a",
    color: "#eaeaea",
    border: "1px solid #2b2b2b",
    borderRadius: 8,
    padding: "10px 12px",
    outline: "none",
};
