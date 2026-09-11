import { cookies } from "next/headers";
import LibraryControls from "@/components/LibraryControls";
import PageIntro from "@/components/PageIntro";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/env";
import CoverThumb from "@/components/CoverThumb";
import GameHoverCard from "@/components/GameHoverCard";

/** Minimal types for what we need on this page */
type GamePreview = {
    id: number;
    name: string;
    cover_url?: string | null;
    release_date?: number | null;
    rating?: number | null;
    platforms?: Array<{ id: number; name: string }>;
};

type SortKey =
    | "recent_desc" // default – newest first (highest id)
    | "name_asc"
    | "name_desc"
    | "year_desc"
    | "year_asc"
    | "rating_desc"
    | "rating_asc";

/** Get previews (fast list) */
async function fetchGames(): Promise<GamePreview[]> {
    const url = `${API_BASE_URL}/games/`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

function previewRating(g: GamePreview): number | null {
    return typeof g.rating === "number" && Number.isFinite(g.rating) ? g.rating : null;
}

function ratingsFromPreviews(games: GamePreview[]): Record<number, number | null> {
    const ratings: Record<number, number | null> = {};
    for (const game of games) {
        ratings[game.id] = previewRating(game);
    }
    return ratings;
}

/** Year helpers */
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

/** Sorting */
function sortGames(
    games: GamePreview[],
    ratings: Record<number, number | null>,
    key: SortKey
) {
    const withMeta = games.map((g) => ({
        ...g,
        _year: toYearNumber(g.release_date),
        _rating: ratings[g.id] ?? null,
    }));

    const byString = (a?: string | null, b?: string | null) =>
        (a ?? "").localeCompare(b ?? "", undefined, { sensitivity: "base" });

    const byNumberDesc = (a?: number | null, b?: number | null) =>
        (b ?? -Infinity) - (a ?? -Infinity);
    const byNumberAsc = (a?: number | null, b?: number | null) =>
        (a ?? Infinity) - (b ?? Infinity);

    switch (key) {
        case "recent_desc":
            withMeta.sort((a, b) => byNumberDesc(a.id, b.id)); // newest id first
            break;
        case "name_asc":
            withMeta.sort((a, b) => byString(a.name, b.name));
            break;
        case "name_desc":
            withMeta.sort((a, b) => byString(b.name, a.name));
            break;
        case "year_desc":
            withMeta.sort((a, b) => byNumberDesc(a._year, b._year));
            break;
        case "year_asc":
            withMeta.sort((a, b) => byNumberAsc(a._year, b._year));
            break;
        case "rating_desc":
            withMeta.sort((a, b) => byNumberDesc(a._rating, b._rating));
            break;
        case "rating_asc":
            withMeta.sort((a, b) => byNumberAsc(a._rating, b._rating));
            break;
    }

    return withMeta;
}

/** Pagination bar */
function PaginationBar({
                           total,
                           page,
                           size,
                           sort,
                           view,
                       }: {
    total: number;
    page: number;
    size: number;
    sort: SortKey;
    view: "grid" | "list";
}) {
    const lastPage = Math.max(1, Math.ceil(total / size));
    const start = total === 0 ? 0 : (page - 1) * size + 1;
    const end = Math.min(total, page * size);
    const link = (p: number) => ({ pathname: "/games", query: { sort, page: p, size, view } });

    return (
        <div
            className="gc-pager"
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
                Showing {start}–{end} of {total}
            </div>

            <div className="gc-pager-links" style={{ display: "flex", gap: 8 }}>
                <Link href={link(1)} aria-disabled={page <= 1} style={page <= 1 ? btnDisabled : btn}>
                    « First
                </Link>
                <Link href={link(Math.max(1, page - 1))} aria-disabled={page <= 1} style={page <= 1 ? btnDisabled : btn}>
                    ‹ Prev
                </Link>
                <div
                    style={{
                        border: "1px solid var(--gc-border)",
                        borderRadius: 8,
                        padding: "6px 10px",
                        background: "var(--gc-surface-raised)",
                        fontSize: 13,
                    }}
                >
                    Page {page} / {lastPage}
                </div>
                <Link
                    href={link(Math.min(lastPage, page + 1))}
                    aria-disabled={page >= lastPage}
                    style={page >= lastPage ? btnDisabled : btn}
                >
                    Next ›
                </Link>
                <Link href={link(lastPage)} aria-disabled={page >= lastPage} style={page >= lastPage ? btnDisabled : btn}>
                    Last »
                </Link>
            </div>
        </div>
    );
}

const btn: React.CSSProperties = {
    textDecoration: "none",
    color: "var(--gc-text-secondary)",
    border: "1px solid var(--gc-border)",
    background: "var(--gc-surface-raised)",
    padding: "6px 10px",
    borderRadius: 8,
    fontSize: 13,
};
const btnDisabled: React.CSSProperties = { ...btn, opacity: 0.5, pointerEvents: "none" };

/** Safe parse */
function parsePositiveInt(s: string | undefined, def: number) {
    const n = Number(s);
    if (!Number.isFinite(n)) return def;
    const i = Math.trunc(n);
    return i > 0 ? i : def;
}

/** Ensure sort param is one of our keys (fallback to recent_desc) */
function coerceSortKey(s: unknown): SortKey {
    const allowed: SortKey[] = [
        "recent_desc",
        "name_asc",
        "name_desc",
        "year_desc",
        "year_asc",
        "rating_desc",
        "rating_asc",
    ];
    return allowed.includes(s as SortKey) ? (s as SortKey) : "recent_desc";
}

export default async function GamesPage(
    props: {
        searchParams?: Promise<{ sort?: string; page?: string; size?: string; view?: string }>;
    }
) {
    const searchParams = await props.searchParams;
    const savedView = (await cookies()).get("gc_library_view")?.value;
    const view = (searchParams?.view ?? savedView) === "list" ? "list" : "grid";
    let games: GamePreview[] = [];
    let error: string | null = null;

    const sortParam = coerceSortKey(searchParams?.sort);
    const page = parsePositiveInt(searchParams?.page, 1);
    const size = Math.min(100, Math.max(5, parsePositiveInt(searchParams?.size, 10))); // 5..100

    try {
        games = await fetchGames();
    } catch (e: unknown) {
        error = e instanceof Error ? e.message : "Unknown error";
    }

    const total = error ? 0 : games.length;

    const ratingsAll = !error ? ratingsFromPreviews(games) : {};

    // Sort
    const sorted = !error ? sortGames(games, ratingsAll, sortParam) : [];

    // Page slice
    const start = (page - 1) * size;
    const end = Math.min(start + size, sorted.length);
    const pageItems = sorted.slice(start, end);

    const pageRatings = !error ? Object.fromEntries(pageItems.map((g) => [g.id, ratingsAll[g.id] ?? null])) : {};

    return (
        <div>
            <PageIntro eyebrow="Your collection" title="Games" description="Explore your shelves. Rediscover your next favourite.">
                <Link href="/search" className="gc-primary-link">Search collection <span aria-hidden="true">↗</span></Link>
            </PageIntro>

            <LibraryControls sort={sortParam} size={size} page={page} view={view} />

            {/* Top pagination */}
            {!error && total > 0 ? <PaginationBar total={total} page={page} size={size} sort={sortParam} view={view} /> : null}

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
                    Failed to load games.
                    <br />
                    <span style={{ fontSize: 12, opacity: 0.9 }}>{error}</span>
                </div>
            ) : null}

            {!error && (!pageItems || pageItems.length === 0) ? <div className="gc-empty-state"><span className="gc-eyebrow">A fresh shelf</span><h2>Your collection starts here</h2><p>Games added to your library will appear here, ready to explore.</p><Link href="/admin/games/add" className="gc-primary-link">Add a game</Link></div> : null}

            {!error && pageItems?.length ? (
                <ul className={`gc-library-grid${view === "list" ? " gc-library-list" : ""}`}>
                    {pageItems.map((g) => {
                        const year = toYearLabel(g.release_date);
                        const platformNames = g.platforms?.map((p) => p.name).join(", ") || "—";
                        const rating = (pageRatings as Record<number, number | null>)[g.id] ?? null;

                        return (
                            <li
                                key={g.id}
                                className="gc-library-card"
                                style={{
                                    display: "flex",
                                    gap: 12,
                                    padding: "12px 8px",
                                    borderBottom: "1px solid var(--gc-border-subtle)",
                                    alignItems: "center",
                                }}
                            >
                                {/* Full cover artwork with existing hover details. */}
                                <GameHoverCard gameId={g.id}>
                                    <Link href={`/games/${g.id}`} className="gc-library-cover">
                                        <CoverThumb
                                            name={g.name}
                                            coverUrl={g.cover_url ?? undefined}
                                            width={240}
                                            height={320}
                                            rounded
                                        />
                                    </Link>
                                </GameHoverCard>

                                {/* Text block */}
                                <div className="gc-library-info" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 4, width: "100%" }}>
                                    <div>
                                        <Link href={`/games/${g.id}`} style={{ color: "#fff", textDecoration: "none", fontWeight: 600 }}>
                                            {g.name}
                                        </Link>
                                        <div style={{ fontSize: 12, opacity: 0.8 }}>{platformNames}</div>
                                    </div>

                                    {/* Right aligned meta */}
                                    <div className="gc-library-meta" style={{ textAlign: "right", fontSize: 12, opacity: 0.9 }}>
                                        <div>Year: {year}</div>
                                        <div>Rating: {rating ?? "—"}</div>
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            ) : null}

            {/* Bottom pagination */}
            {!error && total > 0 ? <PaginationBar total={total} page={page} size={size} sort={sortParam} view={view} /> : null}
        </div>
    );
}
