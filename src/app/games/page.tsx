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
    platforms?: Array<{ id: number; name: string }>;
};
type GameDetails = {
    id: number;
    rating?: number | null;
};

type SortKey =
    | "recent_desc"   // NEW: default – newest first (highest id)
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

/** For rating (not present in preview), fetch minimal details for each game. */
async function fetchRatings(ids: number[]): Promise<Record<number, number | null>> {
    const results: Record<number, number | null> = {};
    await Promise.all(
        ids.map(async (id) => {
            try {
                const res = await fetch(`${API_BASE_URL}/games/${id}`, { cache: "no-store" });
                if (!res.ok) throw new Error();
                const g = (await res.json()) as GameDetails;
                results[id] = g?.rating ?? null;
            } catch {
                results[id] = null;
            }
        })
    );
    return results;
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

/** Small link pill for sort controls that preserves page/size (use UrlObject to satisfy typed routes) */
function SortLink({
                      label,
                      value,
                      active,
                      page,
                      size,
                  }: {
    label: string;
    value: SortKey;
    active: boolean;
    page: number;
    size: number;
}) {
    return (
        <Link
            href={{ pathname: "/games", query: { sort: value, page, size } }}
            style={{
                textDecoration: "none",
                color: active ? "#fff" : "#d8d8d8",
                border: "1px solid " + (active ? "#3b82f6" : "#2b2b2b"),
                background: active ? "#1e293b" : "#151515",
                padding: "6px 10px",
                borderRadius: 8,
                fontSize: 13,
            }}
        >
            {label}
        </Link>
    );
}

/** Pagination bar (use UrlObject to avoid TS2322 with typed routes) */
function PaginationBar({
                           total,
                           page,
                           size,
                           sort,
                       }: {
    total: number;
    page: number;
    size: number;
    sort: SortKey;
}) {
    const lastPage = Math.max(1, Math.ceil(total / size));
    const start = total === 0 ? 0 : (page - 1) * size + 1;
    const end = Math.min(total, page * size);
    const link = (p: number) => ({ pathname: "/games", query: { sort, page: p, size } });

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
                Showing {start}–{end} of {total}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
                <Link href={link(1)} aria-disabled={page <= 1} style={page <= 1 ? btnDisabled : btn}>
                    « First
                </Link>
                <Link href={link(Math.max(1, page - 1))} aria-disabled={page <= 1} style={page <= 1 ? btnDisabled : btn}>
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
    color: "#d8d8d8",
    border: "1px solid #2b2b2b",
    background: "#151515",
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
    return (allowed.includes(s as SortKey) ? (s as SortKey) : "recent_desc");
}

export default async function GamesPage({
                                            searchParams,
                                        }: {
    searchParams?: { sort?: string; page?: string; size?: string };
}) {
    let games: GamePreview[] = [];
    let error: string | null = null;

    const sortParam = coerceSortKey(searchParams?.sort);
    const page = parsePositiveInt(searchParams?.page, 1);
    const size = Math.min(100, Math.max(5, parsePositiveInt(searchParams?.size, 20))); // 5..100

    try {
        games = await fetchGames();
    } catch (e: unknown) {
        error = e instanceof Error ? e.message : "Unknown error";
    }

    const total = error ? 0 : games.length;

    // Ratings:
    // - If sorting by rating, fetch ratings for ALL games (so sort is correct).
    // - Otherwise, fetch ratings only for current page slice.
    let ratingsAll: Record<number, number | null> = {};
    if (!error && total) {
        const needAll = sortParam === "rating_desc" || sortParam === "rating_asc";
        ratingsAll = needAll ? await fetchRatings(games.map((g) => g.id)) : {};
    }

    // Sort
    const sorted = !error ? sortGames(games, ratingsAll, sortParam) : [];

    // Page slice
    const start = (page - 1) * size;
    const end = Math.min(start + size, sorted.length);
    const pageItems = sorted.slice(start, end);

    // Page ratings (if not already fetched for all)
    let pageRatings: Record<number, number | null> = {};
    if (!error && pageItems.length) {
        if (Object.keys(ratingsAll).length) {
            pageRatings = Object.fromEntries(pageItems.map((g) => [g.id, ratingsAll[g.id] ?? null]));
        } else {
            pageRatings = await fetchRatings(pageItems.map((g) => g.id));
        }
    }

    return (
        <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <h1 style={{ fontSize: 24, margin: 0 }}>Games</h1>
            </div>

            {/* Sort bar */}
            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    alignItems: "center",
                    marginBottom: 12,
                }}
            >
                <span style={{ opacity: 0.8, fontSize: 13 }}>Sort by:</span>
                <SortLink label="Recently added" value="recent_desc" active={sortParam === "recent_desc"} page={page} size={size} />
                <SortLink label="Name A–Z" value="name_asc" active={sortParam === "name_asc"} page={page} size={size} />
                <SortLink label="Name Z–A" value="name_desc" active={sortParam === "name_desc"} page={page} size={size} />
                <SortLink label="Year ↓" value="year_desc" active={sortParam === "year_desc"} page={page} size={size} />
                <SortLink label="Year ↑" value="year_asc" active={sortParam === "year_asc"} page={page} size={size} />
                <SortLink label="Rating ↓" value="rating_desc" active={sortParam === "rating_desc"} page={page} size={size} />
                <SortLink label="Rating ↑" value="rating_asc" active={sortParam === "rating_asc"} page={page} size={size} />
            </div>

            {/* Top pagination */}
            {!error && total > 0 ? <PaginationBar total={total} page={page} size={size} sort={sortParam} /> : null}

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

            {!error && (!pageItems || pageItems.length === 0) ? <p>No games found.</p> : null}

            {!error && pageItems?.length ? (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {pageItems.map((g) => {
                        const year = toYearLabel(g.release_date);
                        const platformNames = g.platforms?.map((p) => p.name).join(", ") || "—";
                        const rating = (pageRatings as Record<number, number | null>)[g.id] ?? null;

                        return (
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
                                {/* Cover with hover card (keeps 56×56 size) */}
                                <GameHoverCard gameId={g.id}>
                                    <Link href={{ pathname: `/games/${g.id}` }} style={{ display: "inline-block", flexShrink: 0 }}>
                                        <CoverThumb
                                            name={g.name}
                                            coverUrl={g.cover_url ?? undefined}
                                            width={56}
                                            height={56}
                                            rounded
                                        />
                                    </Link>
                                </GameHoverCard>

                                {/* Text block */}
                                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 4, width: "100%" }}>
                                    <div>
                                        <Link href={{ pathname: `/games/${g.id}` }} style={{ color: "#fff", textDecoration: "none", fontWeight: 600 }}>
                                            {g.name}
                                        </Link>
                                        <div style={{ fontSize: 12, opacity: 0.8 }}>Platforms: {platformNames}</div>
                                    </div>

                                    {/* Right aligned meta */}
                                    <div style={{ textAlign: "right", fontSize: 12, opacity: 0.9 }}>
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
            {!error && total > 0 ? <PaginationBar total={total} page={page} size={size} sort={sortParam} /> : null}
        </div>
    );
}
