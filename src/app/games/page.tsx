import Link from "next/link";
import { API_BASE_URL } from "@/lib/env";

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

/** For rating (not present in preview), fetch minimal details for each game.
 *  NOTE: This is fine for small lists right now. We can optimize later. */
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

/** ---- helpers: year + cover fallback ---- */

function toYearNumber(n?: number | null): number | null {
    if (n == null) return null;
    if (n >= 1000 && n <= 3000) return n; // already a year
    if (n >= 1_000_000_000_000) return new Date(n).getUTCFullYear(); // ms
    if (n >= 1_000_000_000) return new Date(n * 1000).getUTCFullYear(); // sec
    return n; // fallback
}

function toYearLabel(n?: number | null): string {
    const y = toYearNumber(n);
    return y == null ? "—" : String(y);
}

/** Quick, cheap URL validation to avoid broken <img> when users type random text */
function isLikelyHttpUrl(s?: string | null): s is string {
    if (!s) return false;
    try {
        const u = new URL(s);
        return u.protocol === "http:" || u.protocol === "https:";
    } catch {
        return false;
    }
}

function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
}

/** Small JSX helper for covers with graceful fallback */
function CoverThumb({
                        name,
                        coverUrl,
                        size = 56
                    }: {
    name: string;
    coverUrl?: string | null;
    size?: number;
}) {
    const frame: React.CSSProperties = {
        width: size,
        height: size,
        borderRadius: 8,
        border: "1px solid #2b2b2b",
        overflow: "hidden",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#141414",
        flexShrink: 0
    };

    if (isLikelyHttpUrl(coverUrl)) {
        // eslint-disable-next-line @next/next/no-img-element
        return (
            <img
                src={coverUrl}
                alt={name}
                width={size}
                height={size}
                style={{ ...frame, objectFit: "cover" }}
            />
        );
    }

    // Placeholder tile when no/invalid URL
    return (
        <div aria-label={`${name} (no cover)`} style={{ ...frame, background: "linear-gradient(135deg, #1e293b 0%, #0b1220 100%)" }}>
      <span
          style={{
              fontSize: Math.max(16, Math.floor(size * 0.36)),
              fontWeight: 800,
              letterSpacing: 0.5,
              color: "#dbeafe",
              textShadow: "0 1px 0 rgba(0,0,0,0.5), 0 0 8px rgba(59,130,246,0.35)"
          }}
      >
        {getInitials(name)}
      </span>
        </div>
    );
}

function sortGames(
    games: GamePreview[],
    ratings: Record<number, number | null>,
    key: SortKey
) {
    const withMeta = games.map((g) => ({
        ...g,
        _year: toYearNumber(g.release_date),
        _rating: ratings[g.id] ?? null
    }));

    const byString = (a?: string | null, b?: string | null) =>
        (a ?? "").localeCompare(b ?? "", undefined, { sensitivity: "base" });

    const byNumberDesc = (a?: number | null, b?: number | null) =>
        (b ?? -Infinity) - (a ?? -Infinity);
    const byNumberAsc = (a?: number | null, b?: number | null) =>
        (a ?? Infinity) - (b ?? Infinity);

    switch (key) {
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

function SortLink({
                      label,
                      value,
                      active
                  }: {
    label: string;
    value: SortKey;
    active: boolean;
}) {
    return (
        <Link
            href={`/games?sort=${value}`}
            style={{
                textDecoration: "none",
                color: active ? "#fff" : "#d8d8d8",
                border: "1px solid " + (active ? "#3b82f6" : "#2b2b2b"),
                background: active ? "#1e293b" : "#151515",
                padding: "6px 10px",
                borderRadius: 8,
                fontSize: 13
            }}
        >
            {label}
        </Link>
    );
}

export default async function GamesPage({
                                            searchParams
                                        }: {
    searchParams?: { sort?: string };
}) {
    let games: GamePreview[] = [];
    let error: string | null = null;

    const sortParam = (searchParams?.sort as SortKey) || "name_asc";

    try {
        games = await fetchGames();
    } catch (e: unknown) {
        error = e instanceof Error ? e.message : "Unknown error";
    }

    // Fetch ratings only if we actually have games
    const ratings =
        !error && games.length ? await fetchRatings(games.map((g) => g.id)) : {};

    const sorted = !error ? sortGames(games, ratings, sortParam) : [];

    return (
        <div>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 12
                }}
            >
                <h1 style={{ fontSize: 24, margin: 0 }}>Games</h1>
            </div>

            {/* Sort bar */}
            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    alignItems: "center",
                    marginBottom: 12
                }}
            >
                <span style={{ opacity: 0.8, fontSize: 13 }}>Sort by:</span>
                <SortLink label="Name A–Z" value="name_asc" active={sortParam === "name_asc"} />
                <SortLink label="Name Z–A" value="name_desc" active={sortParam === "name_desc"} />
                <SortLink label="Year ↓" value="year_desc" active={sortParam === "year_desc"} />
                <SortLink label="Year ↑" value="year_asc" active={sortParam === "year_asc"} />
                <SortLink label="Rating ↓" value="rating_desc" active={sortParam === "rating_desc"} />
                <SortLink label="Rating ↑" value="rating_asc" active={sortParam === "rating_asc"} />
            </div>

            {error ? (
                <div
                    style={{
                        background: "#3b0f12",
                        border: "1px solid #5b1a1f",
                        color: "#ffd7d7",
                        padding: 12,
                        borderRadius: 8,
                        marginBottom: 16
                    }}
                >
                    Failed to load games.<br />
                    <span style={{ fontSize: 12, opacity: 0.9 }}>{error}</span>
                </div>
            ) : null}

            {!error && (!sorted || sorted.length === 0) ? (
                <p>No games found.</p>
            ) : null}

            {!error && sorted?.length ? (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {sorted.map((g) => {
                        const year = toYearLabel(g.release_date);
                        const platformNames = g.platforms?.map((p) => p.name).join(", ") || "—";
                        const rating = (ratings as Record<number, number | null>)[g.id] ?? null;

                        return (
                            <li
                                key={g.id}
                                style={{
                                    display: "flex",
                                    gap: 12,
                                    padding: "12px 8px",
                                    borderBottom: "1px solid #1f1f1f",
                                    alignItems: "center"
                                }}
                            >
                                {/* Cover (with validation + fallback) */}
                                <Link href={`/games/${g.id}`} style={{ display: "inline-block", flexShrink: 0 }}>
                                    <CoverThumb name={g.name} coverUrl={g.cover_url} size={56} />
                                </Link>

                                {/* Text block */}
                                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 4, width: "100%" }}>
                                    <div>
                                        <Link
                                            href={`/games/${g.id}`}
                                            style={{ color: "#fff", textDecoration: "none", fontWeight: 600 }}
                                        >
                                            {g.name}
                                        </Link>
                                        <div style={{ fontSize: 12, opacity: 0.8 }}>
                                            Platforms: {platformNames}
                                        </div>
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
        </div>
    );
}
