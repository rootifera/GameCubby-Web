import Link from "next/link";
import {API_BASE_URL} from "@/lib/env";
import TagChipsAutocomplete from "@/components/TagChipsAutocomplete";
import GameHoverCard from "@/components/GameHoverCard";
import CoverThumb from "@/components/CoverThumb";
import SearchBox from "@/components/SearchBox";

/* ---------- types ---------- */
type Named = { id: number; name: string };

type GameLike = {
    id: number;
    name: string;
    cover_url?: string | null;
    release_date?: number | null;
    platforms?: Array<{ id: number; name: string }>;
    rating?: number | null; // not in basic preview, we display “—” if missing
};

/* ---------- helpers ---------- */

function toYearLabel(n?: number | null): string {
    if (n == null) return "—";
    if (n >= 1000 && n <= 3000) return String(n);
    if (n >= 1_000_000_000_000) return String(new Date(n).getUTCFullYear()); // ms
    if (n >= 1_000_000_000) return String(new Date(n * 1000).getUTCFullYear()); // sec
    return String(n);
}

function get(sp: Record<string, string | string[] | undefined>, k: string, def = "") {
    return typeof sp[k] === "string" ? (sp[k] as string) : def;
}

function getCSV(sp: Record<string, string | string[] | undefined>, k: string) {
    const v = sp[k];
    if (typeof v === "string") return v;
    if (Array.isArray(v)) return v.join(",");
    return "";
}

/** Build query for /search/basic */
function buildBasicQuery(sp: Record<string, string | string[] | undefined>) {
    const qs = new URLSearchParams();

    // map: prefer ?name, else fall back to ?q from the SearchBox
    const name = get(sp, "name") || get(sp, "q");
    const year = get(sp, "year");
    const platform_id = get(sp, "platform_id");
    const match_mode = get(sp, "match_mode");
    const limit = get(sp, "limit");
    const offset = get(sp, "offset");

    if (name) qs.set("name", name.trim());
    if (year) qs.set("year", year.trim());
    if (platform_id) qs.set("platform_id", platform_id.trim());
    if (match_mode && (match_mode === "any" || match_mode === "all")) qs.set("match_mode", match_mode);
    if (limit) qs.set("limit", limit.trim());
    if (offset) qs.set("offset", offset.trim());

    // tag_ids CSV -> repeated tag_ids=...
    const tagsCSV = getCSV(sp, "tag_ids");
    for (const t of tagsCSV.split(",").map((s) => s.trim()).filter(Boolean)) {
        qs.append("tag_ids", t);
    }

    return qs.toString();
}

async function runBasicSearch(sp: Record<string, string | string[] | undefined>): Promise<GameLike[]> {
    const query = buildBasicQuery(sp);
    const url = `${API_BASE_URL}/search/basic${query ? `?${query}` : ""}`;
    const res = await fetch(url, {cache: "no-store"});
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
    const data = await res.json();
    const list: unknown = (Array.isArray(data) ? data : (data as any)?.results ?? []) as unknown;
    return Array.isArray(list) ? (list as GameLike[]) : [];
}

async function fetchPlatforms(): Promise<Named[]> {
    const res = await fetch(`${API_BASE_URL}/platforms/`, {cache: "no-store"});
    if (!res.ok) throw new Error(`GET /platforms/ -> ${res.status}`);
    return (await res.json()) as Named[];
}

/* ---------- page ---------- */

export default async function BasicSearchPage({
                                                  searchParams,
                                              }: {
    searchParams?: Record<string, string | string[] | undefined>;
}) {
    const sp = searchParams ?? {};
    const q = get(sp, "q");

    // load platforms for single-select
    let platforms: Named[] = [];
    try {
        platforms = await fetchPlatforms();
        platforms.sort((a, b) => a.name.localeCompare(b.name));
    } catch {
        // ignore dropdown load errors (UI will show empty select)
    }

    // fetch results (only when we have any query inputs)
    const hasAnyParam = Object.values(sp).some((v) => (Array.isArray(v) ? v.join("") : v)?.toString().trim());
    let results: GameLike[] = [];
    let error: string | null = null;
    if (hasAnyParam) {
        try {
            results = await runBasicSearch(sp);
        } catch (e) {
            error = e instanceof Error ? e.message : "Unknown error";
        }
    }

    // sticky defaults
    const yearDefault = get(sp, "year");
    const platformDefault = get(sp, "platform_id");
    const matchModeDefault = get(sp, "match_mode");
    const limitDefault = get(sp, "limit", "50");
    const offsetDefault = get(sp, "offset", "0");
    const tagsDefaultCSV = getCSV(sp, "tag_ids");

    return (
        <div style={{padding: 16}}>
            <div style={{marginBottom: 12, display: "flex", gap: 8}}>
                <Link href="/" style={{color: "#a0c4ff", textDecoration: "none"}}>
                    ← Home
                </Link>
            </div>

            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    margin: "0 0 10px 0",
                }}
            >
                <h1 style={{fontSize: 24, margin: 0}}>Search</h1>
                <Link
                    href="/search/advanced"
                    style={{
                        color: "#d8d8d8",
                        textDecoration: "none",
                        border: "1px solid #2b2b2b",
                        background: "#151515",
                        padding: "8px 10px",
                        borderRadius: 8,
                        fontSize: 13,
                    }}
                >
                    Advanced search →
                </Link>
            </div>
            {/* Quick name search with suggestions */}
            <div style={{marginBottom: 12}}>
                <SearchBox defaultValue={q || ""}/>
            </div>

            {/* Toggle-able additional parameters */}
            <details style={detailsWrap}>
                <summary style={summaryBar}>
                    <span>Additional parameters</span>
                    <span style={{opacity: 0.8, fontSize: 12}}>Optional filters for the basic search</span>
                </summary>

                {/* This form submits extra filters. We keep 'name' in sync by passing current q as hidden. */}
                <form method="GET" action="/search" style={{display: "grid", gap: 12, padding: "12px"}}>
                    {/* keep name from the SearchBox when you add extra filters */}
                    <input type="hidden" name="name" value={q || ""}/>

                    {/* Row 1 — Year & Platform */}
                    <div style={{display: "grid", gap: 12, gridTemplateColumns: "200px 1fr"}}>
                        <LabeledInput
                            label="Year (exact)"
                            name="year"
                            type="number"
                            defaultValue={yearDefault}
                            placeholder="1998"
                            short
                        />

                        <div style={{display: "grid", gap: 6}}>
                            <label style={{opacity: 0.85}}>Platform</label>
                            <select name="platform_id" defaultValue={platformDefault} style={selectStyle}>
                                <option value="">Any platform</option>
                                {platforms.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Row 2 — Tags (with autocomplete) & Match mode */}
                    <div style={{display: "grid", gap: 12, gridTemplateColumns: "1fr 200px"}}>
                        <TagChipsAutocomplete label="Tags" name="tag_ids" suggestKind="tags"
                                              defaultSelectedIds={parseIdsCSV(tagsDefaultCSV)}/>
                        <div style={{display: "grid", gap: 6}}>
                            <label style={{opacity: 0.85}}>Tag match</label>
                            <select name="match_mode" defaultValue={matchModeDefault || "any"} style={selectStyle}>
                                <option value="any">Any of selected</option>
                                <option value="all">All selected</option>
                            </select>
                        </div>
                    </div>

                    {/* Row 3 — Limit & Offset */}
                    <div style={{display: "grid", gap: 12, gridTemplateColumns: "200px 200px"}}>
                        <LabeledInput label="Limit" name="limit" type="number" defaultValue={limitDefault}
                                      placeholder="50" short/>
                        <LabeledInput
                            label="Offset"
                            name="offset"
                            type="number"
                            defaultValue={offsetDefault}
                            placeholder="0"
                            short
                            title="How many results to skip (for pagination)"
                        />
                    </div>

                    {/* Actions */}
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
                            Search with filters
                        </button>
                        <Link
                            href="/search"
                            style={{
                                color: "#d8d8d8",
                                border: "1px solid #2b2b2b",
                                borderRadius: 8,
                                padding: "10px 14px",
                                textDecoration: "none",
                            }}
                        >
                            Reset filters
                        </Link>
                    </div>
                </form>
            </details>

            {/* Results */}
            {error ? (
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
                    Failed to search.
                    <div style={{marginTop: 6, fontSize: 12, opacity: 0.9}}>{error}</div>
                </div>
            ) : null}

            {!error && results.length > 0 ? (
                <ul style={{listStyle: "none", padding: 0, margin: "12px 0 0 0"}}>
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
                                    <div>Rating: {typeof g.rating === "number" ? g.rating : "—"}</div>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : hasAnyParam && !error ? (
                <p style={{opacity: 0.8, marginTop: 12}}>No results.</p>
            ) : null}
        </div>
    );
}

/* ---------- small bits ---------- */

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
                    ...(short ? {maxWidth: 200} : null),
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

/* Collapsible styles (match advanced page) */
const detailsWrap: React.CSSProperties = {
    border: "1px solid #222",
    borderRadius: 10,
    background: "#121212",
    marginTop: 8,
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

/* parse CSV from sticky params into ids for TagChipsAutocomplete */
function parseIdsCSV(csv: string): Array<number | string> {
    return csv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => (Number.isNaN(Number(s)) ? s : Number(s)));
}
