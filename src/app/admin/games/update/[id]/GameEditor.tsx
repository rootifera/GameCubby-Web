"use client";

import React, { useMemo, useRef, useState } from "react";
import type { IdName, Game } from "./page";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";
import LocationTreePicker from "@/components/LocationTreePicker";
import TagChipsAutocomplete from "@/components/TagChipsAutocomplete";

/* ---------------- helpers ---------------- */

function toCSV(arr?: Array<number | string> | null): string {
    if (!arr || !Array.isArray(arr) || arr.length === 0) return "";
    return arr.map((v) => String(v)).join(",");
}
function csvToIds(csv: string): number[] {
    return csv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => Number(s))
        .filter((n) => Number.isFinite(n));
}
function csvToIdsOrStrings(csv: string): Array<number | string> {
    return csv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
            const n = Number(s);
            return Number.isFinite(n) ? n : s;
        });
}
function yearFromRelease(
    release_date?: number | null,
    release_year?: number | null
): number | "" {
    if (typeof release_year === "number") return release_year;
    if (typeof release_date === "number") {
        if (release_date >= 1000 && release_date <= 3000) return release_date;
        if (release_date >= 1_000_000_000_000)
            return new Date(release_date).getUTCFullYear();
        if (release_date >= 1_000_000_000)
            return new Date(release_date * 1000).getUTCFullYear();
    }
    return "";
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* A tiny styled input */
const inputStyle: React.CSSProperties = {
    background: "#121212",
    color: "#eaeaea",
    border: "1px solid #262626",
    borderRadius: 8,
    padding: "8px 10px",
    outline: "none",
};
const selectStyle: React.CSSProperties = { ...inputStyle, paddingRight: 28 };
const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    minHeight: 120,
    resize: "vertical" as const,
};
const row: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "160px 1fr",
    gap: 8,
    alignItems: "center",
    marginBottom: 10,
};
const btn: React.CSSProperties = {
    display: "inline-block",
    background: "#1b1b1b",
    color: "#eaeaea",
    border: "1px solid #2e2e2e",
    borderRadius: 8,
    padding: "8px 12px",
    cursor: "pointer",
    textDecoration: "none",
};
const btnDisabled: React.CSSProperties = { ...btn, opacity: 0.6, cursor: "not-allowed" };
const sectionTitle: React.CSSProperties = { fontWeight: 700, margin: "14px 0 8px" };
const hint: React.CSSProperties = { fontSize: 12, opacity: 0.75 };
const overlayWrap: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    display: "grid",
    placeItems: "center",
    zIndex: 1000,
};
const overlayCard: React.CSSProperties = {
    background: "#0f0f0f",
    border: "1px solid #2b2b2b",
    borderRadius: 12,
    padding: "16px 18px",
    minWidth: 220,
    textAlign: "center",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
    fontWeight: 600,
};

/* ---------------- props ---------------- */

type Lookups = {
    platforms: IdName[];
    modes: IdName[];
    genres: IdName[];
    perspectives: IdName[];
    companies: IdName[];
    collections: IdName[];
};

export default function GameEditor({
                                       initialData,
                                       lookups,
                                   }: {
    initialData: Game;
    lookups: Lookups;
}) {
    const isCustom = initialData.igdb_id === 0;
    const isIGDB = !isCustom;

    // force child inputs to re-mount if we ever need to (not used by the hard reload path)
    const [nonce] = useState(0);

    // Basic fields
    const [name, setName] = useState(initialData.name ?? "");
    const [summary, setSummary] = useState(initialData.summary ?? "");
    const [rating, setRating] = useState<number | "">(
        typeof initialData.rating === "number" ? initialData.rating : ""
    );
    const [releaseYear, setReleaseYear] = useState<number | "">(
        yearFromRelease(initialData.release_date, initialData.release_year)
    );
    const [coverUrl, setCoverUrl] = useState(initialData.cover_url ?? "");
    const [order, setOrder] = useState<number | "">(
        typeof initialData.order === "number" ? initialData.order : ""
    );

    // Condition: dropdown 1..10 (or blank)
    const [condition, setCondition] = useState<number | "">(
        typeof initialData.condition === "number" ? initialData.condition : ""
    );

    // Refs
    const formRef = useRef<HTMLFormElement | null>(null);
    const navigatingRef = useRef(false); // ← prevents overlay from being cleared before reload

    // Location preselect: last item in location_path
    const initialLocationId = useMemo(() => {
        const path = (initialData as any).location_path as Array<{ id: unknown }> | undefined;
        if (Array.isArray(path) && path.length > 0) {
            const last = path[path.length - 1];
            const n = Number((last as any)?.id);
            if (Number.isFinite(n) && n > 0) return n;
        }
        const v1 = (initialData as any).location_id;
        const v2 = (initialData as any).location?.id;
        const num = Number(v1 ?? v2);
        return Number.isFinite(num) && num > 0 ? num : undefined;
    }, [initialData]);

    const initialPlatformIds = useMemo(
        () =>
            (initialData.platform_ids && initialData.platform_ids.length
                ? initialData.platform_ids
                : (initialData.platforms ?? [])
                    .map((p: any) => p?.id)
                    .filter((v: any) => Number.isFinite(v))) ?? [],
        [initialData.platform_ids, initialData.platforms]
    );
    const initialModeIds = useMemo(
        () =>
            (initialData.mode_ids && initialData.mode_ids.length
                ? initialData.mode_ids
                : (initialData.modes ?? [])
                    .map((m: any) => m?.id)
                    .filter((v: any) => Number.isFinite(v))) ?? [],
        [initialData.mode_ids, initialData.modes]
    );
    const initialGenreIds = useMemo(
        () =>
            (initialData.genre_ids && initialData.genre_ids.length
                ? initialData.genre_ids
                : (initialData.genres ?? [])
                    .map((g: any) => g?.id)
                    .filter((v: any) => Number.isFinite(v))) ?? [],
        [initialData.genre_ids, initialData.genres]
    );
    const initialPerspectiveIds = useMemo(() => {
        if (
            initialData.player_perspective_ids &&
            initialData.player_perspective_ids.length
        ) {
            return initialData.player_perspective_ids;
        }
        const src =
            (initialData as any).player_perspectives ??
            (initialData as any).playerperspectives ??
            [];
        return (src as any[])
            .map((p: any) => p?.id)
            .filter((v: any) => Number.isFinite(v));
    }, [initialData]);
    const initialCompanyIds = useMemo(() => {
        if (initialData.company_ids && initialData.company_ids.length) {
            return initialData.company_ids;
        }
        const list: any[] = (initialData as any).companies ?? [];
        return list
            .map((c: any) => {
                if (Number.isFinite(c?.id)) return c.id;
                if (Number.isFinite(c?.company?.id)) return c.company.id;
                return undefined;
            })
            .filter((v: any) => Number.isFinite(v));
    }, [initialData]);
    const initialCollectionId = useMemo(
        () =>
            typeof initialData.collection_id === "number"
                ? initialData.collection_id
                : initialData.collection?.id ?? undefined,
        [initialData.collection_id, initialData.collection]
    );
    const initialTagCsv = useMemo(() => {
        if (initialData.tag_ids && initialData.tag_ids.length)
            return toCSV(initialData.tag_ids);
        if (initialData.tags && initialData.tags.length) {
            return toCSV(
                (initialData.tags as any[]).map((t: any) =>
                    typeof t.id === "number" ? t.id : t.name
                )
            );
        }
        return "";
    }, [initialData.tag_ids, initialData.tags]);

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Prefer tag_ids_mix JSON if present, else fallback to CSV
    function readMixedTagIds(fd: FormData, baseName: string): Array<number | string> {
        const mixRaw = (fd.get(`${baseName}_mix`) as string) || "";
        if (mixRaw) {
            try {
                const parsed = JSON.parse(mixRaw);
                if (Array.isArray(parsed)) {
                    const clean = parsed
                        .map((v) => {
                            const n = Number(v);
                            if (Number.isFinite(n)) return n;
                            const s = String(v).trim();
                            return s ? s : null;
                        })
                        .filter((v): v is number | string => v !== null);
                    const seen = new Set<string>();
                    const uniq: Array<number | string> = [];
                    for (const item of clean) {
                        const key = typeof item === "number" ? `n:${item}` : `s:${item.toLowerCase()}`;
                        if (!seen.has(key)) {
                            seen.add(key);
                            uniq.push(item);
                        }
                    }
                    return uniq;
                }
            } catch {
                // ignore and fall through to CSV
            }
        }
        const csv = (fd.get(baseName) as string) || "";
        return csvToIdsOrStrings(csv);
    }

    // Poll until GET reflects the PUT changes
    async function waitForFreshData(
        id: number,
        expected: {
            condition?: number;
            order?: number;
            location_id?: number;
            platform_ids?: number[];
            tag_ids?: Array<number | string>;
        }
    ) {
        const maxMs = 8000;
        const intervalMs = 250;
        const tries = Math.ceil(maxMs / intervalMs);

        const asNumArray = (v: any): number[] =>
            Array.isArray(v) ? v.map((x) => Number(x)).filter((n) => Number.isFinite(n)) : [];
        const lastLocIdFromPath = (path: any): number | undefined => {
            if (Array.isArray(path) && path.length) {
                const n = Number(path[path.length - 1]?.id);
                if (Number.isFinite(n) && n > 0) return n;
            }
            return undefined;
        };
        const tagSetFromResponse = (data: any): Set<string> => {
            const s = new Set<string>();
            const ids = asNumArray(data?.tag_ids);
            ids.forEach((n) => s.add(`n:${n}`));
            if (Array.isArray(data?.tags)) {
                for (const t of data.tags) {
                    if (Number.isFinite(t?.id)) s.add(`n:${Number(t.id)}`);
                    const nm = String(t?.name || "").trim();
                    if (nm) s.add(`s:${nm.toLowerCase()}`);
                }
            }
            return s;
        };
        const tagSetFromExpected = (arr: Array<number | string> = []): Set<string> => {
            const s = new Set<string>();
            for (const it of arr) {
                const n = Number(it);
                if (Number.isFinite(n)) s.add(`n:${n}`);
                else {
                    const nm = String(it).trim().toLowerCase();
                    if (nm) s.add(`s:${nm}`);
                }
            }
            return s;
        };

        const wantTags = tagSetFromExpected(expected.tag_ids);

        for (let i = 0; i < tries; i++) {
            try {
                const res = await fetch(`/api/proxy/games/${id}?_=${Date.now()}&i=${i}`, {
                    cache: "no-store",
                });
                if (res.ok) {
                    const data = await res.json();

                    const gotPlatforms =
                        expected.platform_ids
                            ? JSON.stringify(asNumArray(data?.platform_ids).sort()) ===
                            JSON.stringify(asNumArray(expected.platform_ids).sort()) ||
                            JSON.stringify(asNumArray((data?.platforms || []).map((p: any) => p?.id)).sort()) ===
                            JSON.stringify(asNumArray(expected.platform_ids).sort())
                            : true;

                    const gotCond = expected.condition ? Number(data?.condition) === expected.condition : true;
                    const gotOrder = expected.order ? Number(data?.order) === expected.order : true;

                    const gotLoc = expected.location_id
                        ? (Number(data?.location_id) || lastLocIdFromPath(data?.location_path)) === expected.location_id
                        : true;

                    const gotTags =
                        wantTags.size === 0
                            ? true
                            : (() => {
                                const have = tagSetFromResponse(data);
                                for (const key of wantTags) if (!have.has(key)) return false;
                                return true;
                            })();

                    if (gotPlatforms && gotCond && gotOrder && gotLoc && gotTags) return;
                }
            } catch {
                // ignore and retry
            }
            await sleep(intervalMs);
        }
    }

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!formRef.current) return;

        setSaving(true);
        setError(null);

        const fd = new FormData(formRef.current);

        // Read hidden controls
        const locationIdVal = (fd.get("location_id") as string) || "";
        const platformCsv = (fd.get("platform_ids") as string) || "";
        const modeCsv = (fd.get("mode_ids") as string) || "";
        const genreCsv = (fd.get("genre_ids") as string) || "";
        const perspectiveCsv = (fd.get("player_perspective_ids") as string) || "";
        const companyCsv = (fd.get("company_ids") as string) || "";
        const collectionIdVal = (fd.get("collection_id") as string) || "";

        const platform_ids = csvToIds(platformCsv);
        const mode_ids = csvToIds(modeCsv);
        const genre_ids = csvToIds(genreCsv);
        const player_perspective_ids = csvToIds(perspectiveCsv);
        const company_ids = csvToIds(companyCsv);
        const collection_id = collectionIdVal ? Number(collectionIdVal) : 0;
        const location_id = locationIdVal ? Number(locationIdVal) : 0;

        // tags (numbers + new strings)
        const tag_ids = readMixedTagIds(fd, "tag_ids");

        try {
            const id = initialData.id;

            let payload: any;

            if (isIGDB) {
                // IGDB-linked: allowed fields
                payload = {
                    condition:
                        typeof condition === "number" ? condition : condition === "" ? 0 : Number(condition),
                    location_id: Number.isFinite(location_id) && location_id > 0 ? location_id : 0,
                    order: typeof order === "number" ? order : order === "" ? 0 : Number(order),
                    platform_ids,
                    tag_ids,
                };
            } else {
                // Custom game: full schema
                payload = {
                    name: name.trim(),
                    summary: (summary || "").trim(),
                    release_date: releaseYear === "" ? 0 : Number(releaseYear),
                    cover_url: (coverUrl || "").trim(),
                    condition:
                        typeof condition === "number" ? condition : condition === "" ? 0 : Number(condition),
                    location_id: Number.isFinite(location_id) && location_id > 0 ? location_id : 0,
                    order: typeof order === "number" ? order : order === "" ? 0 : Number(order),
                    mode_ids,
                    platform_ids,
                    genre_ids,
                    player_perspective_ids,
                    rating: rating === "" ? 0 : Number(rating),
                    tag_ids,
                    collection_id: Number.isFinite(collection_id) && collection_id > 0 ? collection_id : 0,
                    company_ids,
                };
            }

            // Authenticated admin route
            const res = await fetch(`/api/admin/games/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(`PUT /api/admin/games/${id} failed (${res.status}) ${text}`);
            }

            // Wait until GET reflects changes
            await waitForFreshData(id, {
                condition: payload.condition,
                order: payload.order,
                location_id: payload.location_id,
                platform_ids: payload.platform_ids,
                tag_ids: payload.tag_ids,
            });

            // Extra beat for any caches
            await sleep(300);

            // HARD refresh and keep overlay visible until navigation begins
            navigatingRef.current = true;
            const url = `${window.location.pathname}?_=${Date.now()}`;
            window.location.replace(url);
            return;
        } catch (err: any) {
            setError(err?.message ?? "Failed to save changes");
        } finally {
            // Only clear the overlay if we are NOT navigating away
            if (!navigatingRef.current) {
                await sleep(250);
                setSaving(false);
            }
        }
    }

    function resetForm() {
        const url = `${window.location.pathname}?_=${Date.now()}`;
        window.location.replace(url);
    }

    /* ---------- UI ---------- */

    return (
        <>
            <form ref={formRef} onSubmit={onSubmit} aria-busy={saving}>
                <div style={sectionTitle}>
                    {isIGDB ? "IGDB-linked game (limited editing)" : "Custom game (fully editable)"}
                </div>
                <div style={hint}>
                    {isIGDB
                        ? "Editable: Condition, Location, Order, Platforms, Tags. Other fields are read-only (from IGDB)."
                        : "All fields are editable for custom games."}
                </div>

                {/* ----- Basics ----- */}
                <div style={sectionTitle}>Basics</div>

                {/* Name */}
                <div style={row}>
                    <label htmlFor="g_name">Name</label>
                    <input
                        id="g_name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        style={inputStyle}
                        disabled={isIGDB}
                        required
                    />
                </div>

                {/* Release year */}
                <div style={row}>
                    <label htmlFor="g_year">Release Year</label>
                    <input
                        id="g_year"
                        value={releaseYear}
                        onChange={(e) => {
                            const v = e.target.value.replace(/[^\d]/g, "");
                            if (v === "") return setReleaseYear("");
                            const n = Number(v);
                            if (Number.isFinite(n)) setReleaseYear(n);
                        }}
                        inputMode="numeric"
                        placeholder="e.g. 1998"
                        style={inputStyle}
                        disabled={isIGDB}
                    />
                </div>

                {/* Rating */}
                <div style={row}>
                    <label htmlFor="g_rating">Rating</label>
                    <input
                        id="g_rating"
                        value={rating}
                        onChange={(e) => {
                            const v = e.target.value.trim();
                            if (v === "") return setRating("");
                            const n = Number(v);
                            if (!Number.isFinite(n)) return;
                            setRating(n);
                        }}
                        inputMode="decimal"
                        placeholder="0 - 100"
                        style={inputStyle}
                        disabled={isIGDB}
                    />
                </div>

                {/* Cover URL */}
                <div style={row}>
                    <label htmlFor="g_cover">Cover URL</label>
                    <input
                        id="g_cover"
                        value={coverUrl}
                        onChange={(e) => setCoverUrl(e.target.value)}
                        style={inputStyle}
                        disabled={isIGDB}
                    />
                </div>

                {/* Summary */}
                <div style={row}>
                    <label htmlFor="g_summary">Summary</label>
                    <textarea
                        id="g_summary"
                        value={summary}
                        onChange={(e) => setSummary(e.target.value)}
                        style={textareaStyle}
                        disabled={isIGDB}
                    />
                </div>

                {/* ----- Editables for both (IGDB limited) ----- */}
                <div style={sectionTitle}>Library Fields</div>

                {/* Condition */}
                <div style={row}>
                    <label htmlFor="g_condition">Condition</label>
                    <select
                        id="g_condition"
                        value={condition === "" ? "" : String(condition)}
                        onChange={(e) => {
                            const v = e.target.value;
                            if (v === "") return setCondition("");
                            const n = Number(v);
                            if (!Number.isFinite(n)) return;
                            setCondition(n);
                        }}
                        style={selectStyle}
                    >
                        <option value="">—</option>
                        {Array.from({ length: 10 }, (_, i) => i + 1).map((val) => (
                            <option key={val} value={val}>
                                {val}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Location */}
                <div key={`loc-${nonce}`} style={{ marginBottom: 10 }}>
                    <LocationTreePicker
                        label="Location"
                        name="location_id"
                        defaultSelectedId={initialLocationId}
                        height={220}
                    />
                </div>

                {/* Order */}
                <div style={row}>
                    <label htmlFor="g_order">Order</label>
                    <input
                        id="g_order"
                        value={order}
                        onChange={(e) => {
                            const v = e.target.value.trim();
                            if (v === "") return setOrder("");
                            const n = Number(v);
                            if (!Number.isFinite(n)) return;
                            setOrder(n);
                        }}
                        inputMode="numeric"
                        style={inputStyle}
                    />
                </div>

                {/* Platforms */}
                <div key={`plat-${nonce}`} style={{ marginBottom: 10 }}>
                    <MultiSelectDropdown
                        label="Platforms"
                        name="platform_ids"
                        options={lookups.platforms}
                        defaultSelectedIds={initialPlatformIds}
                        multiple={true}
                        placeholder="Select platforms…"
                    />
                </div>

                {/* Tags */}
                <div key={`tags-${nonce}`} style={{ marginBottom: 10 }}>
                    <TagChipsAutocomplete
                        label="Tags"
                        name="tag_ids"
                        suggestKind="tags"
                        defaultSelectedIds={csvToIdsOrStrings(initialTagCsv)}
                    />
                    <div style={hint}>You can add existing or new tags; free-text is allowed.</div>
                </div>

                {/* ----- Custom-only fields ----- */}
                <div style={sectionTitle}>Classification (Custom only)</div>

                {/* IGDB: non-interactive */}
                <div
                    style={{
                        opacity: isIGDB ? 0.6 : 1,
                        pointerEvents: isIGDB ? "none" : "auto",
                        userSelect: isIGDB ? ("none" as const) : "auto",
                    }}
                    title={isIGDB ? "Read-only for IGDB-linked games" : undefined}
                >
                    {/* Modes */}
                    <div key={`modes-${nonce}`} style={{ marginBottom: 10 }}>
                        <MultiSelectDropdown
                            label="Modes"
                            name="mode_ids"
                            options={lookups.modes}
                            defaultSelectedIds={initialModeIds}
                            multiple={true}
                            placeholder="Select modes…"
                        />
                    </div>

                    {/* Genres */}
                    <div key={`genres-${nonce}`} style={{ marginBottom: 10 }}>
                        <MultiSelectDropdown
                            label="Genres"
                            name="genre_ids"
                            options={lookups.genres}
                            defaultSelectedIds={initialGenreIds}
                            multiple={true}
                            placeholder="Select genres…"
                        />
                    </div>

                    {/* Perspectives */}
                    <div key={`persp-${nonce}`} style={{ marginBottom: 10 }}>
                        <MultiSelectDropdown
                            label="Player perspectives"
                            name="player_perspective_ids"
                            options={lookups.perspectives}
                            defaultSelectedIds={initialPerspectiveIds}
                            multiple={true}
                            placeholder="Select perspectives…"
                        />
                    </div>

                    {/* Collection */}
                    <div key={`coll-${nonce}`} style={{ marginBottom: 10 }}>
                        <MultiSelectDropdown
                            label="Collection"
                            name="collection_id"
                            options={lookups.collections}
                            defaultSelectedIds={
                                typeof initialCollectionId === "number" ? [initialCollectionId] : []
                            }
                            multiple={false}
                            placeholder="No collection"
                        />
                    </div>

                    {/* Companies */}
                    <div key={`comp-${nonce}`} style={{ marginBottom: 10 }}>
                        <MultiSelectDropdown
                            label="Companies"
                            name="company_ids"
                            options={lookups.companies}
                            defaultSelectedIds={initialCompanyIds}
                            multiple={true}
                            placeholder="Select companies…"
                        />
                    </div>
                </div>

                {isIGDB && (
                    <div style={{ ...hint, marginTop: -6, marginBottom: 8 }}>
                        Above fields are shown for reference and will not be updated for IGDB-linked games
                        (only Condition, Location, Order, Platforms, Tags are editable).
                    </div>
                )}

                {/* ----- actions ----- */}
                {error && <div style={{ color: "#ff6666", marginBottom: 8 }}>{error}</div>}

                <div style={{ display: "flex", gap: 8 }}>
                    <button type="submit" style={!saving ? btn : btnDisabled} disabled={saving}>
                        {saving ? "Saving…" : "Save Changes"}
                    </button>
                    <button type="button" style={!saving ? btn : btnDisabled} onClick={resetForm} disabled={saving}>
                        Reset
                    </button>
                </div>
            </form>

            {/* Blocking overlay while saving / waiting for fresh data */}
            {saving ? (
                <div style={overlayWrap} role="alert" aria-live="assertive">
                    <div style={overlayCard}>Saving…</div>
                </div>
            ) : null}
        </>
    );
}
