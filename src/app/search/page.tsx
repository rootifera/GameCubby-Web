import Link from "next/link";
import { API_BASE_URL } from "@/lib/env";
import SearchBox from "@/components/SearchBox";
import TagChipsAutocomplete from "@/components/TagChipsAutocomplete";
import CoverThumb from "@/components/CoverThumb";
import GameHoverCard from "@/components/GameHoverCard";

/* ------------ types ------------ */

type Named = { id: number; name: string };
type GamePreview = {
    id: number;
    name: string;
    cover_url?: string | null;
    release_date?: number | null;
    platforms?: Array<{ id: number; name: string }>;
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
function get(sp: Record<string, string | string[] | undefined>, k: string, def = "") {
    return typeof sp[k] === "string" ? (sp[k] as string) : def;
}
function parsePositiveInt(s: string | undefined, def: number) {
    const n = Number(s);
    if (!Number.isFinite(n)) return def;
    const i = Math.trunc(n);
    return i > 0 ? i : def;
}
function parseIdsCSV(csv: string): number[] {
    return csv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => Number(s))
        .filter((n) => Number.isFinite(n));
}

/** Build query for /search/basic (repeated tag_ids, exact platform_id/year, plus limit/offset) */
function buildBasicApiQuery(
    sp: Record<string, string | string[] | undefined>,
    size: number,
    page: number
) {
    const qs = new URLSearchParams();
    const name = get(sp, "q");
    const year = get(sp, "year");
    const platform_id = get(sp, "platform_id");
    const match_mode = get(sp, "match_mode");
    const tagCsv = get(sp, "tag_ids");

    if (name) qs.set("name", name);
    if (year) qs.set("year", year);
    if (platform_id) qs.set("platform_id", platform_id);

    // now allow: any | all | exact  (fallback to any)
    if (match_mode) {
        const allowed = new Set(["any", "all", "exact"]);
        qs.set("match_mode", allowed.has(match_mode) ? match_mode : "any");
    }

    const tagIds = parseIdsCSV(tagCsv);
    for (const t of tagIds) qs.append("tag_ids", String(t));

    // pagination: ask for one extra to know if "next" exists
    const limit = Math.min(100, Math.max(1, size)) + 1;
    const offset = Math.max(0, (page - 1) * size);
    qs.set("limit", String(limit));
    qs.set("offset", String(offset));

    return qs.toString();
}

/** Fetch platforms for single-select */
async function fetchPlatforms(): Promise<Named[]> {
    const res = await fetch(`${API_BASE_URL}/platforms/`, { cache: "no-store" });
    if (!res.ok) throw new Error(`GET /platforms/ -> ${res.status}`);
    const arr = (await res.json()) as Named[];
    return Array.isArray(arr) ? arr : [];
}

/** Fetch basic search results via API */
async function fetchBasic(
    sp: Record<string, string | string[] | undefined>,
    size: number,
    page: number
) {
    const qs = buildBasicApiQuery(sp, size, page);
    const url = `${API_BASE_URL}/search/basic?${qs}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
    const data = await res.json();
    const list: GamePreview[] = Array.isArray(data) ? data : (data as any)?.results ?? [];
    return Array.isArray(list) ? list : [];
}

/** Build a UrlObject preserving current filters and changing page/size */
function buildPageUrl(
    sp: Record<string, string | string[] | undefined>,
    page: number,
    size: number
) {
    const query: Record<string, string> = {};

    const carry = ["q", "year", "platform_id", "tag_ids", "match_mode"] as const;
    for (const k of carry) {
        const v = get(sp, k);
        if (v) query[k] = v;
    }

    query.page = String(page);
    query.size = String(size);

    return { pathname: "/search", query };
}

export default async function BasicSearchPage({
                                                  searchParams,
                                              }: {
    searchParams?: Record<string, string | string[] | undefined>;
}) {
    const sp = searchParams ?? {};

    // pagination (default page=1, size=20)
    const page = parsePositiveInt(get(sp, "page"), 1);
    const size = Math.min(100, Math.max(5, parsePositiveInt(get(sp, "size"), 20)));

    // load platforms for the dropdown
    const [platforms] = await Promise.all([fetchPlatforms()]);

    let results: GamePreview[] = [];
    let error: string | null = null;

    // only run if there's some input
    const hasAnyParam = Object.values(sp).some((v) =>
        (Array.isArray(v) ? v.join("") : v)?.toString().trim()
    );
    if (hasAnyParam) {
        try {
            const arr = await fetchBasic(sp, size, page);
            results = arr.slice(0, size); // show only page size
        } catch (e: unknown) {
            error = e instanceof Error ? e.message : "Unknown error";
        }
    }

    const q = get(sp, "q");
    const year = get(sp, "year");
    const platform_id = get(sp, "platform_id");
    const tagCsv = get(sp, "tag_ids");
    const match_mode = get(sp, "match_mode") || "any";

    // Re-fetch unsliced to determine hasNext
    let hasNextPage = false;
    if (!error && hasAnyParam) {
        try {
            const full = await fetchBasic(sp, size, page);
            hasNextPage = full.length > size;
            results = full.slice(0, size);
        } catch {
            /* ignore */
        }
    }

    const start = results.length ? (page - 1) * size + 1 : 0;
    const end = (page - 1) * size + results.length;

    return (
        <div>
            {/* Top header (match /games) */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <h1 style={{ fontSize: 24, margin: 0 }}>Search</h1>
            </div>

            {/* Basic / Advanced toggle below header (match /games bar spacing) */}
            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    alignItems: "center",
                    marginBottom: 12,
                }}
            >
                <Link href={{ pathname: "/search" }} style={toggleActive} aria-current="page">
                    Basic
                </Link>
                <Link href={{ pathname: "/search/advanced" }} style={toggleInactive}>
                    Advanced
                </Link>
            </div>

            {/* Search bar (same width rhythm as /games controls) */}
            <div style={{ marginBottom: 16 }}>
                <div style={{ maxWidth: 540, width: "100%" }}>
                    {/* CHANGED: do not repopulate from URL */}
                    <SearchBox defaultValue="" />
                </div>
            </div>

            {/* Extra parameters */}
            <details style={detailsWrap}>
                <summary style={summaryBar}>
                    <span>Additional parameters</span>
                    <button 
                        type="button" 
                        style={toggleButtonStyle}
                        onClick={(e) => {
                            e.preventDefault();
                            const details = e.currentTarget.closest('details');
                            if (details) {
                                details.open = !details.open;
                            }
                        }}
                    >
                        Toggle
                    </button>
                </summary>

                <form method="GET" action="/search" style={{ display: "grid", gap: 16, padding: "16px", marginBottom: 12 }}>
                    {/* Keep q sticky */}
                    <input type="hidden" name="q" value={q} />

                    {/* Row 1 — Year + Platform */}
                    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "200px 1fr" }}>
                        <label style={{ display: "grid", gap: 6 }}>
                            <span style={{ opacity: 0.85 }}>Year (exact)</span>
                            <input
                                name="year"
                                defaultValue={year}
                                inputMode="numeric"
                                placeholder="1998"
                                style={inputShort}
                            />
                        </label>

                        <label style={{ display: "grid", gap: 6 }}>
                            <span style={{ opacity: 0.85 }}>Platform</span>
                            <select name="platform_id" defaultValue={platform_id} style={selectStyle}>
                                <option value="">Any</option>
                                {platforms
                                    .slice()
                                    .sort((a, b) => a.name.localeCompare(b.name))
                                    .map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}
                                        </option>
                                    ))}
                            </select>
                        </label>
                    </div>

                    {/* Row 2 — Tags + Match mode */}
                    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 200px" }}>
                        <TagChipsAutocomplete
                            label="Tags"
                            name="tag_ids"
                            suggestKind="tags"
                            defaultSelectedIds={parseIdsCSV(tagCsv)}
                            searchOnly={true}
                        />
                        <label style={{ display: "grid", gap: 6 }}>
                            <span style={{ opacity: 0.85 }}>Tag match</span>
                            <select name="match_mode" defaultValue={match_mode} style={selectStyle}>
                                <option value="any">Any</option>
                                <option value="all">All</option>
                                <option value="exact">Exact</option>
                            </select>
                        </label>
                    </div>

                    {/* Page size control */}
                    <div style={{ display: "grid", gap: 6, maxWidth: 200 }}>
                        <span style={{ opacity: 0.85 }}>Page size</span>
                        <input name="size" defaultValue={String(size)} inputMode="numeric" style={inputShort} />
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
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
                            Apply
                        </button>
                        <Link
                            href={{ pathname: "/search" }}
                            style={{
                                color: "#d8d8d8",
                                border: "1px solid #2b2b2b",
                                borderRadius: 8,
                                padding: "10px 14px",
                                textDecoration: "none",
                            }}
                        >
                            Reset
                        </Link>
                    </div>
                </form>
            </details>

            {/* Pagination (top) */}
            {hasAnyParam && !error ? (
                <BasicPager
                    page={page}
                    hasNext={hasNextPage}
                    start={start}
                    end={end}
                    hrefBuilder={(p) => buildPageUrl(sp, p, size)}
                />
            ) : null}

            {/* Errors & empty states */}
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
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>{error}</div>
                </div>
            ) : null}

            {!error && hasAnyParam && results.length === 0 ? (
                <p style={{ opacity: 0.8 }}>No results.</p>
            ) : null}

            {/* Results */}
            {!error && results.length ? (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
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
                            {/* Cover + hover */}
                            <GameHoverCard gameId={g.id}>
                                <Link href={`/games/${g.id}`} style={{ display: "inline-block", flexShrink: 0 }}>
                                    <CoverThumb
                                        name={g.name}
                                        coverUrl={g.cover_url ?? undefined}
                                        width={56}
                                        height={56}
                                        rounded
                                    />
                                </Link>
                            </GameHoverCard>

                            {/* Info */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 4, width: "100%" }}>
                                <div>
                                    <Link href={`/games/${g.id}`} style={{ color: "#fff", textDecoration: "none", fontWeight: 600 }}>
                                        {g.name}
                                    </Link>
                                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                                        Platforms: {(g.platforms ?? []).map((p) => p.name).join(", ") || "—"}
                                    </div>
                                </div>
                                <div style={{ textAlign: "right", fontSize: 12, opacity: 0.9 }}>
                                    <div>Year: {toYearLabel(g.release_date)}</div>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : null}

            {/* Pagination (bottom) */}
            {hasAnyParam && !error ? (
                <BasicPager
                    page={page}
                    hasNext={hasNextPage}
                    start={start}
                    end={end}
                    hrefBuilder={(p) => buildPageUrl(sp, p, size)}
                />
            ) : null}
        </div>
    );
}

/* ------------ small components/styles ------------ */

function BasicPager({
                        page,
                        hasNext,
                        start,
                        end,
                        hrefBuilder,
                    }: {
    page: number;
    hasNext: boolean;
    start: number;
    end: number;
    hrefBuilder: (p: number) => { pathname: string; query: Record<string, string> };
}) {
    return (
        <div
            style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                justifyContent: "space-between",
                margin: "12px 0",
                flexWrap: "wrap",
            }}
        >
            <div style={{ opacity: 0.85, fontSize: 12 }}>
                {start ? <>Showing {start}–{end}</> : <>No results</>}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
                <Link href={hrefBuilder(1)} aria-disabled={page <= 1} style={page <= 1 ? btnDisabled : btn}>
                    « First
                </Link>
                <Link href={hrefBuilder(Math.max(1, page - 1))} aria-disabled={page <= 1} style={page <= 1 ? btnDisabled : btn}>
                    ‹ Prev
                </Link>
                <div
                    style={{
                        border: "1px solid #2b2b2b",
                        borderRadius: 8,
                        padding: "6px 10px",
                        background: "#151515",
                        fontSize: 13,
                    }}
                >
                    Page {page}
                </div>
                <Link href={hrefBuilder(page + 1)} aria-disabled={!hasNext} style={!hasNext ? btnDisabled : btn}>
                    Next ›
                </Link>
            </div>
        </div>
    );
}

const inputShort: React.CSSProperties = {
    background: "#1a1a1a",
    color: "#eaeaea",
    border: "1px solid #2b2b2b",
    borderRadius: 8,
    padding: "12px 16px",
    outline: "none",
    maxWidth: 200,
};

const selectStyle: React.CSSProperties = {
    background: "#1a1a1a",
    color: "#eaeaea",
    border: "1px solid #2b2b2b",
    borderRadius: 8,
    padding: "12px 16px",
    outline: "none",
};

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
const btnDisabled: React.CSSProperties = { ...btn, opacity: 0.5, pointerEvents: "none" };

/* Toggle button styles */
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

const toggleButtonStyle: React.CSSProperties = {
    ...toggleBase,
    background: "#151515",
    color: "#d8d8d8",
    border: "1px solid #2b2b2b",
    padding: "6px 10px",
    borderRadius: 8,
    fontSize: 13,
};
