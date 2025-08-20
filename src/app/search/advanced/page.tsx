import Link from "next/link";
import {API_BASE_URL} from "@/lib/env";
import MultiSelectDropdown, {type Option} from "@/components/MultiSelectDropdown";
import TagChipsAutocomplete from "@/components/TagChipsAutocomplete";
import LocationTreePicker from "@/components/LocationTreePicker";
import CoverThumb from "@/components/CoverThumb";
import GameHoverCard from "@/components/GameHoverCard";
import SearchBox from "@/components/SearchBox";
import { ToggleButton } from "./ToggleButton";

/** Minimal shape we render */
type GameLike = {
    id: number;
    name: string;
    cover_url?: string | null;
    release_date?: number | null;
    platforms?: Array<{ id: number; name: string }>;
    rating?: number | null;
};

type Named = { id: number; name: string };

function toYearLabel(n?: number | null): string {
    if (n == null) return "—";
    if (n >= 1000 && n <= 3000) return String(n);
    if (n >= 1_000_000_000_000) return String(new Date(n).getUTCFullYear());
    if (n >= 1_000_000_000) return String(new Date(n * 1000).getUTCFullYear());
    return String(n);
}

/** Helpers to read params */
function get(sp: Record<string, string | string[] | undefined>, k: string, def = "") {
    return typeof sp[k] === "string" ? (sp[k] as string) : def;
}

function getCSV(sp: Record<string, string | string[] | undefined>, k: string) {
    const v = sp[k];
    if (typeof v === "string") return v;
    if (Array.isArray(v)) return v.join(",");
    return "";
}

function parseIdsCSV(csv: string): Array<number | string> {
    return csv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => (Number.isNaN(Number(s)) ? s : Number(s)));
}

/** take first id out of possible CSV for single-value fields */
function firstId(sp: Record<string, string | string[] | undefined>, key: string) {
    const raw = get(sp, key, "");
    const first = raw.split(",").map((s) => s.trim()).filter(Boolean)[0];
    return first ?? "";
}

/** Determine if the query has any *meaningful* filters (not just defaults) */
function hasMeaningfulFilters(sp: Record<string, string | string[] | undefined>) {
    const nonEmpty = (k: string) => {
        const v = sp[k];
        if (typeof v === "string") return v.trim().length > 0;
        if (Array.isArray(v)) return v.join("").trim().length > 0;
        return false;
    };

    // ignore helpers/defaults
    const ignoreKeys = new Set([
        "limit",
        "offset",
        "match_mode",        // default "any"
        "igdb_match_mode",   // default "any"
        "platform_match_mode",
        "genre_match_mode",
        "mode_match_mode",
        "perspective_match_mode",
        "company_match_mode",
        "show_filters",
        "__reset",
        "__ts",
    ]);

    // If ANY of the meaningful ones present, we count it:
    const meaningfulKeys = [
        "name",
        "year",
        "year_min",
        "year_max",
        "platform_ids",
        "tag_ids",
        "genre_ids",
        "mode_ids",
        "perspective_ids",
        "igdb_tag_ids",
        "collection_id",
        "company_id",
        "company_ids",
        "location_id",
        "include_manual",
    ];

    for (const k of meaningfulKeys) {
        if (nonEmpty(k)) return true;
    }

    // If the only params are ignorable ones, return false
    for (const [k, v] of Object.entries(sp)) {
        if (ignoreKeys.has(k)) continue;
        if (Array.isArray(v) ? v.join("").trim() : (v as string | undefined)?.trim()) {
            return true;
        }
    }
    return false;
}

/** Build upstream query string from our searchParams (normalized) */
function buildQuery(sp: Record<string, string | string[] | undefined>) {
    const qs = new URLSearchParams();

    // Simple passthrough string/int params
    const passthrough = [
        "name",
        "year",
        "year_min",
        "year_max",
        "location_id",
        "include_manual",
        "limit",
        "offset",
        // tag match modes
        "match_mode",
        "igdb_match_mode",
        // new match modes
        "platform_match_mode",
        "genre_match_mode",
        "mode_match_mode",
        "perspective_match_mode",
        "company_match_mode",
    ] as const;

    for (const key of passthrough) {
        const v = sp[key];
        if (typeof v === "string" && v.trim() !== "") qs.set(key, v.trim());
    }

    // Normalize single-value IDs (in case UI submits CSV for single-select)
    const collection = firstId(sp, "collection_id");
    if (collection) qs.set("collection_id", collection);

    // Repeated params
    const multi = [
        "platform_ids",
        "tag_ids",
        "genre_ids",
        "mode_ids",
        "perspective_ids",
        "igdb_tag_ids",
        "company_ids", // NEW
    ] as const;

    for (const key of multi) {
        const v = sp[key];
        const raw = typeof v === "string" ? v : Array.isArray(v) ? v.join(",") : "";
        const parts = raw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

        const seen = new Set<string>();
        for (const p of parts) {
            if (seen.has(p)) continue;
            seen.add(p);
            qs.append(key, p);
        }
    }

    return qs.toString();
}

async function runAdvancedSearch(
    sp: Record<string, string | string[] | undefined>
): Promise<GameLike[]> {
    const query = buildQuery(sp);
    const url = `${API_BASE_URL}/search/advanced${query ? `?${query}` : ""}`;
    const res = await fetch(url, {cache: "no-store"});
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
    const data = await res.json();
    const list: unknown = (Array.isArray(data) ? data : (data as any)?.results ?? []) as unknown;
    return Array.isArray(list) ? (list as GameLike[]) : [];
}

/** -------- Basic fallback (temporary) -------- */
function isBasicCompatible(sp: Record<string, string | string[] | undefined>) {
    const usedKeys = Object.entries(sp)
        .filter(([k, v]) => {
            if ([
                "limit", "offset",
                "match_mode", "igdb_match_mode",
                "platform_match_mode", "genre_match_mode", "mode_match_mode", "perspective_match_mode", "company_match_mode",
                "show_filters", "__reset", "__ts"
            ].includes(k)) return false;
            return (Array.isArray(v) ? v.join("") : v)?.toString().trim();
        })
        .map(([k]) => k);

    const allowed = new Set([
        "name",
        "year",
        "platform_ids", // we’ll take first id as platform_id
        "tag_ids",
        "limit",
        "offset",
    ]);

    return usedKeys.length > 0 && usedKeys.every((k) => allowed.has(k));
}

async function runBasicFallback(
    sp: Record<string, string | string[] | undefined>
): Promise<GameLike[]> {
    const qs = new URLSearchParams();
    const name = typeof sp.name === "string" ? sp.name.trim() : "";
    const year = typeof sp.year === "string" ? sp.year.trim() : "";
    const limit = typeof sp.limit === "string" ? sp.limit.trim() : "";
    const offset = typeof sp.offset === "string" ? sp.offset.trim() : "";

    if (name) qs.set("name", name);
    if (year) qs.set("year", year);
    if (limit) qs.set("limit", limit);
    if (offset) qs.set("offset", offset);

    // platform_ids CSV -> first value as platform_id
    const platformCSV = getCSV(sp, "platform_ids");
    const firstPlatform = platformCSV
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)[0];
    if (firstPlatform) qs.set("platform_id", firstPlatform);

    // tag_ids CSV -> repeated tag_ids params
    const tagsCSV = getCSV(sp, "tag_ids");
    for (const t of tagsCSV.split(",").map((s) => s.trim()).filter(Boolean)) {
        qs.append("tag_ids", t);
    }

    const url = `${API_BASE_URL}/search/basic${qs.toString() ? `?${qs.toString()}` : ""}`;
    const res = await fetch(url, {cache: "no-store"});
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
    const data = await res.json();
    const list: unknown = (Array.isArray(data) ? data : (data as any)?.results ?? []) as unknown;
    return Array.isArray(list) ? (list as GameLike[]) : [];
}

/** ------------------------------------------- */

/** Fetch options */
async function fetchPlatforms(): Promise<Option[]> {
    const res = await fetch(`${API_BASE_URL}/platforms/`, {cache: "no-store"});
    if (!res.ok) throw new Error(`GET /platforms/ -> ${res.status}`);
    const arr = (await res.json()) as Named[];
    return arr.map((p) => ({id: p.id, name: p.name})).sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchGenres(): Promise<Option[]> {
    const res = await fetch(`${API_BASE_URL}/genres/`, {cache: "no-store"});
    if (!res.ok) throw new Error(`GET /genres/ -> ${res.status}`);
    const arr = (await res.json()) as Array<Named | Record<string, any>>;
    return arr
        .map((g: any) => ({id: Number(g.id), name: String(g.name || "")}))
        .filter((g) => Number.isFinite(g.id) && g.name)
        .sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchPerspectives(): Promise<Option[]> {
    const res = await fetch(`${API_BASE_URL}/perspectives/`, {cache: "no-store"});
    if (!res.ok) throw new Error(`GET /perspectives/ -> ${res.status}`);
    const arr = (await res.json()) as Array<Record<string, any>>;
    return arr
        .map((p) => ({id: Number(p.id), name: String(p.name || "")}))
        .filter((p) => Number.isFinite(p.id) && p.name)
        .sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchModes(): Promise<Option[]> {
    const res = await fetch(`${API_BASE_URL}/modes/`, {cache: "no-store"});
    if (!res.ok) throw new Error(`GET /modes/ -> ${res.status}`);
    const arr = (await res.json()) as Array<Named>;
    return arr.map((m) => ({id: m.id, name: m.name})).sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchCollections(): Promise<Option[]> {
    const res = await fetch(`${API_BASE_URL}/collections/`, {cache: "no-store"});
    if (!res.ok) throw new Error(`GET /collections/ -> ${res.status}`);
    const arr = (await res.json()) as Array<Named>;
    return arr.map((c) => ({id: c.id, name: c.name})).sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchCompanies(): Promise<Option[]> {
    const res = await fetch(`${API_BASE_URL}/company/`, {cache: "no-store"});
    if (!res.ok) throw new Error(`GET /company/ -> ${res.status}`);
    const arr = (await res.json()) as Array<Record<string, any>>;
    const mapped = arr
        .map((c) => ({id: Number(c.id), name: String(c.name || "")}))
        .filter((c) => Number.isFinite(c.id) && c.name);
    return mapped.sort((a, b) => a.name.localeCompare(b.name));
}

/** Build a UrlObject to this page with patched search params (for pagination/buttons) */
function hrefWith(
    sp: Record<string, string | string[] | undefined>,
    patch: Record<string, string>
): { pathname: string; query: Record<string, string> } {
    // Start with current params (collapse arrays to CSV for stability)
    const query: Record<string, string> = {};
    for (const [k, v] of Object.entries(sp)) {
        if (typeof v === "string") query[k] = v;
        else if (Array.isArray(v)) query[k] = v.join(",");
    }
    // Apply patch (offset/limit etc.)
    for (const [k, v] of Object.entries(patch)) query[k] = v;
    return {pathname: "/search/advanced", query};
}

export default async function AdvancedSearchPage({
                                                     searchParams,
                                                 }: {
    searchParams?: Record<string, string | string[] | undefined>;
}) {
    const sp = searchParams ?? {};

    // server-side understanding of whether filters are used
    const meaningful = hasMeaningfulFilters(sp);

    // Parse limit/offset for pagination (server-side)
    const parsedLimit = Math.max(1, Number(get(sp, "limit", "50")) || 50);
    const parsedOffset = Math.max(0, Number(get(sp, "offset", "0")) || 0);

    // Fetch all dropdown data in parallel
    const [
        platformOptions,
        genreOptions,
        perspectiveOptions,
        modeOptions,
        collectionOptions,
        companyOptions,
    ] = await Promise.all([
        fetchPlatforms(),
        fetchGenres(),
        fetchPerspectives(),
        fetchModes(),
        fetchCollections(),
        fetchCompanies(),
    ]);

    // Run search only if meaningful filters are present
    let results: GameLike[] = [];
    let error: string | null = null;
    let usedFallback = false;

    if (meaningful) {
        try {
            results = await runAdvancedSearch(sp);
        } catch (e: unknown) {
            // If API advanced search fails and the query is basic-compatible, try basic fallback
            if (isBasicCompatible(sp)) {
                try {
                    results = await runBasicFallback(sp);
                    usedFallback = true;
                } catch (e2) {
                    error = e2 instanceof Error ? e2.message : "Unknown error (fallback failed)";
                }
            } else {
                error = e instanceof Error ? e.message : "Unknown error";
            }
        }
    }

    // Preselects (sticky form)
    const platformDefaultIds = parseIdsCSV(getCSV(sp, "platform_ids"));
    const genreDefaultIds = parseIdsCSV(getCSV(sp, "genre_ids"));
    const perspectiveDefaultIds = parseIdsCSV(getCSV(sp, "perspective_ids"));
    const modeDefaultIds = parseIdsCSV(getCSV(sp, "mode_ids"));
    const tagDefaultIds = parseIdsCSV(getCSV(sp, "tag_ids"));
    const igdbTagDefaultIds = parseIdsCSV(getCSV(sp, "igdb_tag_ids"));
    const collectionDefaultId = firstId(sp, "collection_id");

    // Company preselects: support both company_ids and (legacy) single company_id
    const companyIdsCSV = [getCSV(sp, "company_ids"), get(sp, "company_id", "")]
        .filter(Boolean)
        .join(",");
    const companyDefaultIds = parseIdsCSV(companyIdsCSV);

    const locationDefaultId = get(sp, "location_id"); // preselect in picker if present

    // Match modes (default 'any' in UI—ignored if default)
    const tagMatch = get(sp, "match_mode") || "any";
    const igdbTagMatch = get(sp, "igdb_match_mode") || "any";
    const platformMatch = get(sp, "platform_match_mode") || "any";
    const genreMatch = get(sp, "genre_match_mode") || "any";
    const modeMatch = get(sp, "mode_match_mode") || "any";
    const perspectiveMatch = get(sp, "perspective_match_mode") || "any";
    const companyMatch = get(sp, "company_match_mode") || "any";

    // Filters toggle
    const forceShowFilters = get(sp, "show_filters") === "1";
    const openFilters = forceShowFilters || !meaningful;

    // Pagination booleans
    const canPrev = parsedOffset > 0;
    const canNext = results.length === parsedLimit; // heuristic (no total from API)

    return (
        <div>
            {/* Top header (match /games & basic search) */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <h1 style={{ fontSize: 24, margin: 0 }}>Search</h1>
            </div>

            {/* Basic / Advanced toggle below header (consistent spacing) */}
            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    alignItems: "center",
                    marginBottom: 12,
                }}
            >
                <Link href={{ pathname: "/search" }} style={toggleInactive}>
                    Basic
                </Link>
                <Link href={{ pathname: "/search/advanced" }} style={toggleActive} aria-current="page">
                    Advanced
                </Link>
            </div>

            <details id="filters" open={openFilters} style={detailsWrap}>
                <summary style={summaryBar}>
                    <span>Filters</span>
                    <ToggleButton
                        isOpen={openFilters}
                        onToggle={() => {
                            const details = document.getElementById("filters");
                            if (details) {
                                details.open = !details.open;
                            }
                        }}
                    />
                </summary>

                <form method="GET" action="/search/advanced" style={{display: "grid", gap: 16, padding: "16px", marginBottom: 16}}>
                    {/* Row 1 — Name | Year (exact) - aligned with Platform row */}
                    <div style={{display: "grid", gap: 16, gridTemplateColumns: "1fr 200px"}}>
                        <label style={{display: "grid", gap: 6}}>
                            <span style={{opacity: 0.85}}>Name</span>
                            {/* Identical suggestions behavior as Basic, but no navigation & parent form handles submit */}
                            <SearchBox
                                name="name"
                                defaultValue={get(sp, "name")}
                                onSelectNavigateTo={null}
                                wrapWithForm={false}
                                placeholder="partial name…"
                            />
                        </label>
                        <LabeledInput label="Year (exact)" name="year" type="number" defaultValue={get(sp, "year")}
                                      placeholder="1998" short/>
                    </div>

                    {/* Row 2 — Year from | Year to */}
                    <div style={{display: "grid", gap: 16, gridTemplateColumns: "200px 200px"}}>
                        <LabeledInput label="Year from" name="year_min" type="number" defaultValue={get(sp, "year_min")}
                                      placeholder="1990" short/>
                        <LabeledInput label="Year to" name="year_max" type="number" defaultValue={get(sp, "year_max")}
                                      placeholder="2005" short/>
                    </div>

                    {/* Row 3 — Platform Dropdown | Platform match | Genre | Genre match */}
                    <div style={{display: "grid", gap: 16, gridTemplateColumns: "1fr 200px 1fr 200px"}}>
                        <MultiSelectDropdown
                            label="Platform"
                            name="platform_ids"
                            options={platformOptions}
                            defaultSelectedIds={platformDefaultIds}
                            multiple
                            placeholder="Select platforms…"
                        />
                        <label style={{display: "grid", gap: 6}}>
                            <span style={{opacity: 0.85}}>Platform match</span>
                            <select name="platform_match_mode" defaultValue={platformMatch} style={selectStyle}>
                                <option value="">Default (Any)</option>
                                <option value="any">Any</option>
                                <option value="all">All</option>
                                <option value="exact">Exact</option>
                            </select>
                        </label>
                        <MultiSelectDropdown
                            label="Genre"
                            name="genre_ids"
                            options={genreOptions}
                            defaultSelectedIds={genreDefaultIds}
                            multiple
                            placeholder="Select genres…"
                        />
                        <label style={{display: "grid", gap: 6}}>
                            <span style={{opacity: 0.85}}>Genre match</span>
                            <select name="genre_match_mode" defaultValue={genreMatch} style={selectStyle}>
                                <option value="">Default (Any)</option>
                                <option value="any">Any</option>
                                <option value="all">All</option>
                                <option value="exact">Exact</option>
                            </select>
                        </label>
                    </div>

                    {/* Row 4 — Player Perspective Dropdown | Player Perspective Match | Mode | Mode Match */}
                    <div style={{display: "grid", gap: 16, gridTemplateColumns: "1fr 200px 1fr 200px"}}>
                        <MultiSelectDropdown
                            label="Player Perspective"
                            name="perspective_ids"
                            options={perspectiveOptions}
                            defaultSelectedIds={perspectiveDefaultIds}
                            multiple
                            placeholder="Select perspectives…"
                        />
                        <label style={{display: "grid", gap: 6}}>
                            <span style={{opacity: 0.85}}>Player Perspective Match</span>
                            <select name="perspective_match_mode" defaultValue={perspectiveMatch} style={selectStyle}>
                                <option value="">Default (Any)</option>
                                <option value="any">Any</option>
                                <option value="all">All</option>
                                <option value="exact">Exact</option>
                            </select>
                        </label>
                        <MultiSelectDropdown
                            label="Mode"
                            name="mode_ids"
                            options={modeOptions}
                            defaultSelectedIds={modeDefaultIds}
                            multiple
                            placeholder="Select modes…"
                        />
                        <label style={{display: "grid", gap: 6}}>
                            <span style={{opacity: 0.85}}>Mode Match</span>
                            <select name="mode_match_mode" defaultValue={modeMatch} style={selectStyle}>
                                <option value="">Default (Any)</option>
                                <option value="any">Any</option>
                                <option value="all">All</option>
                                <option value="exact">Exact</option>
                            </select>
                        </label>
                    </div>

                    {/* Row 5 — Company Dropdown | Company match */}
                    <div style={{display: "grid", gap: 16, gridTemplateColumns: "1fr 200px"}}>
                        <MultiSelectDropdown
                            label="Company"
                            name="company_ids"
                            options={companyOptions}
                            defaultSelectedIds={companyDefaultIds}
                            multiple
                            placeholder="Select companies…"
                        />
                        <label style={{display: "grid", gap: 6}}>
                            <span style={{opacity: 0.85}}>Company match</span>
                            <select name="company_match_mode" defaultValue={companyMatch} style={selectStyle}>
                                <option value="">Default (Any)</option>
                                <option value="any">Any</option>
                                <option value="all">All</option>
                                <option value="exact">Exact</option>
                            </select>
                        </label>
                    </div>

                    {/* Row 6 — Collection (full width) */}
                    <div>
                        <MultiSelectDropdown
                            label="Collection"
                            name="collection_id"
                            options={collectionOptions}
                            defaultSelectedIds={collectionDefaultId ? [collectionDefaultId] : []}
                            multiple={false}
                            placeholder="Select a collection…"
                            compact
                        />
                    </div>

                    {/* Row 7 — Tags | IGDB Tags */}
                    <div style={{display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr"}}>
                        <TagChipsAutocomplete 
                            label="Tags" 
                            name="tag_ids" 
                            suggestKind="tags"
                            defaultSelectedIds={tagDefaultIds}
                            searchOnly={true}
                        />
                        <TagChipsAutocomplete 
                            label="IGDB Tags" 
                            name="igdb_tag_ids" 
                            suggestKind="igdb_tags"
                            defaultSelectedIds={igdbTagDefaultIds}
                            searchOnly={true}
                        />
                    </div>

                    {/* Row 7.1 — Tag match modes (aligned with tags above) */}
                    <div style={{display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr"}}>
                        <label style={{display: "grid", gap: 6}}>
                            <span style={{opacity: 0.85}}>Tag match</span>
                            <select name="match_mode" defaultValue={tagMatch} style={selectStyle}>
                                <option value="">Default (Any)</option>
                                <option value="any">Any</option>
                                <option value="all">All</option>
                                <option value="exact">Exact</option>
                            </select>
                        </label>
                        <label style={{display: "grid", gap: 6}}>
                            <span style={{opacity: 0.85}}>IGDB Tag match</span>
                            <select name="igdb_match_mode" defaultValue={igdbTagMatch} style={selectStyle}>
                                <option value="">Default (Any)</option>
                                <option value="any">Any</option>
                                <option value="all">All</option>
                                <option value="exact">Exact</option>
                            </select>
                        </label>
                    </div>

                    {/* Row 8 — Location */}
                    <div>
                        <LocationTreePicker
                            label="Location"
                            name="location_id"
                            defaultSelectedId={locationDefaultId ? Number(locationDefaultId) : undefined}
                        />
                    </div>

                    {/* Row 9 — Include Custom Games */}
                    <div style={{display: "grid", gap: 6, maxWidth: 360}}>
                        <label style={{opacity: 0.85}}>Include Custom Games</label>
                        <select name="include_manual" defaultValue={get(sp, "include_manual")} style={selectStyle}>
                            <option value="">Default (Yes)</option>
                            <option value="false">No</option>
                            <option value="only">Show Only Custom Games</option>
                        </select>
                    </div>

                    {/* Row 10 — Limit | Offset (narrower, positioned under Include Custom Games) */}
                    <div style={{display: "grid", gap: 24, gridTemplateColumns: "160px 160px"}}>
                        <LabeledInput label="Limit" name="limit" type="number" defaultValue={get(sp, "limit", "50")}
                                      placeholder="50" short/>
                        <LabeledInput label="Offset" name="offset" type="number" defaultValue={get(sp, "offset", "0")}
                                      placeholder="0" short/>
                    </div>

                    {/* Buttons */}
                    <div style={{display: "flex", gap: 8}}>
                        <button
                            type="submit"
                            style={{
                                background: "#1e293b",
                                color: "#fff",
                                border: "1px solid #3b82f6",
                                borderRadius: 8,
                                padding: "10px 14px",
                                fontWeight: 600,
                                cursor: "pointer",
                            }}
                        >
                            Search
                        </button>
                        {/* Hard reset — navigate to clean URL */}
                        <a href="/search/advanced" style={btn}>
                            Reset
                        </a>
                    </div>
                </form>
            </details>

            {usedFallback ? (
                <div
                    style={{
                        background: "#1f2937",
                        border: "1px solid #3b82f6",
                        color: "#dbeafe",
                        padding: 10,
                        borderRadius: 8,
                        marginBottom: 12,
                    }}
                >
                    Advanced search failed on the API, so we used a basic-search fallback for this query.
                </div>
            ) : null}

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
                    Failed to search.
                    <div style={{marginTop: 6, fontSize: 12, opacity: 0.9}}>{error}</div>
                </div>
            ) : null}

            {/* Back to filters link when results are shown */}
            {meaningful && (results.length > 0 || !error) ? (
                <div style={{marginBottom: 8}}>
                    <Link href={hrefWith(sp, {show_filters: "1"})} style={{color: "#a0c4ff", textDecoration: "none"}}>
                        ↑ Back to filters
                    </Link>
                </div>
            ) : null}

            {/* Results */}
            {results.length ? (
                <>
                    <ul style={{listStyle: "none", padding: 0, margin: 0}}>
                        {results.map((g) => (
                            <li
                                key={g.id}
                                style={{
                                    display: "flex",
                                    gap: 12,
                                    padding: "12px 8px",
                                    borderBottom: "1px solid #1f1f1f",
                                    alignItems: "center",
                                }}
                            >
                                {/* Cover with hover card (56×56, robust placeholder) */}
                                <GameHoverCard gameId={g.id}>
                                    <Link href={`/games/${g.id}`} style={{display: "inline-block", flexShrink: 0}}>
                                        <CoverThumb name={g.name} coverUrl={g.cover_url ?? undefined} width={56}
                                                    height={56}/>
                                    </Link>
                                </GameHoverCard>

                                {/* Info */}
                                <div style={{display: "grid", gridTemplateColumns: "1fr auto", gap: 4, width: "100%"}}>
                                    <div>
                                        <Link href={`/games/${g.id}`}
                                              style={{color: "#fff", textDecoration: "none", fontWeight: 600}}>
                                            {g.name}
                                        </Link>
                                        <div style={{fontSize: 12, opacity: 0.8}}>
                                            Platforms: {(g.platforms ?? []).map((p) => p.name).join(", ") || "—"}
                                        </div>
                                    </div>
                                    <div style={{textAlign: "right", fontSize: 12, opacity: 0.9}}>
                                        <div>Year: {toYearLabel(g.release_date)}</div>
                                        <div>Rating: {g.rating ?? "—"}</div>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>

                    {/* Pagination */}
                    <div style={{display: "flex", alignItems: "center", gap: 8, marginTop: 12}}>
                        <span style={{opacity: 0.8, fontSize: 12}}>
                            Showing {parsedOffset + 1}–{parsedOffset + results.length}
                        </span>
                        <div style={{flex: 1}}/>
                        <Link
                            href={hrefWith(sp, {
                                offset: String(Math.max(0, parsedOffset - parsedLimit)),
                                limit: String(parsedLimit)
                            })}
                            aria-disabled={!canPrev}
                            style={canPrev ? btn : btnDisabled}
                        >
                            ← Prev
                        </Link>
                        <Link
                            href={hrefWith(sp, {
                                offset: String(parsedOffset + parsedLimit),
                                limit: String(parsedLimit)
                            })}
                            aria-disabled={!canNext}
                            style={canNext ? btn : btnDisabled}
                        >
                            Next →
                        </Link>
                    </div>
                </>
            ) : meaningful && !error ? (
                <p style={{opacity: 0.8}}>No results.</p>
            ) : null}
        </div>
    );
}

function LabeledInput(
    props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; short?: boolean }
) {
    const {label, short, style, ...inputProps} = props;
    return (
        <label style={{display: "grid", gap: 6}}>
            <span style={{opacity: 0.85}}>{label}</span>
            <input
                {...inputProps}
                style={{
                    background: "#1a1a1a",
                    color: "#eaeaea",
                    border: "1px solid #2b2b2b",
                    borderRadius: 8,
                    padding: "10px 12px",
                    outline: "none",
                    ...(short ? {maxWidth: 160} : null),
                    ...style,
                }}
            />
        </label>
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

/* Shared styles (match Basic Search & Games) */
const detailsWrap: React.CSSProperties = {
    border: "1px solid #222",
    borderRadius: 10,
    background: "#121212",
    marginBottom: 16,
};
const summaryBar: React.CSSProperties = {
    listStyle: "none",
    cursor: "pointer",
    userSelect: "none" as const,
    padding: "10px 12px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid #222",
    color: "#eaeaea",
    fontWeight: 600,
};

const btn: React.CSSProperties = {
    textDecoration: "none",
    color: "#d8d8d8",
    border: "1px solid #2b2b2b",
    background: "#151515",
    padding: "6px 10px",
    borderRadius: 8,
    fontSize: 13,
};
const btnDisabled: React.CSSProperties = {...btn, opacity: 0.5, pointerEvents: "none"};

const toggleBase: React.CSSProperties = {
    textDecoration: "none",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 13,
    border: "1px solid #2b2b2b",
};
const toggleActive: React.CSSProperties = {
    ...toggleBase,
    background: "#1e293b",
    borderColor: "#3b82f6",
    color: "#fff",
    fontWeight: 600,
};
const toggleInactive: React.CSSProperties = {
    ...toggleBase,
    background: "#151515",
    color: "#d8d8d8",
};
