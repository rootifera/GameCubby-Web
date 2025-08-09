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

/** Tries to derive a human year from various numeric formats */
function toYear(n?: number | null): string {
    if (n == null) return "—";
    // Already a year?
    if (n >= 1000 && n <= 3000) return String(n);
    // Epoch milliseconds?
    if (n >= 1_000_000_000_000) return String(new Date(n).getUTCFullYear());
    // Epoch seconds?
    if (n >= 1_000_000_000) return String(new Date(n * 1000).getUTCFullYear());
    return String(n); // fallback
}

export default async function GamesPage() {
    let games: GamePreview[] = [];
    let error: string | null = null;

    try {
        games = await fetchGames();
    } catch (e: unknown) {
        error = e instanceof Error ? e.message : "Unknown error";
    }

    // Fetch ratings only if we actually have games
    const ratings = !error && games.length
        ? await fetchRatings(games.map((g) => g.id))
        : {};

    return (
        <div>
            <h1 style={{ fontSize: 24, margin: "0 0 16px 0" }}>Games</h1>

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

            {!error && (!games || games.length === 0) ? (
                <p>No games found.</p>
            ) : null}

            {!error && games?.length ? (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {games.map((g) => {
                        const year = toYear(g.release_date);
                        const platformNames = g.platforms?.map((p) => p.name).join(", ") || "—";
                        const rating = ratings[g.id] ?? null;

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
                                {/* Cover */}
                                <Link href={`/games/${g.id}`} style={{ display: "inline-block", flexShrink: 0 }}>
                                    {g.cover_url ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={g.cover_url}
                                            alt={g.name}
                                            width={56}
                                            height={56}
                                            style={{
                                                width: 56,
                                                height: 56,
                                                objectFit: "cover",
                                                borderRadius: 8,
                                                border: "1px solid #2b2b2b",
                                                background: "#141414"
                                            }}
                                        />
                                    ) : (
                                        <div
                                            style={{
                                                width: 56,
                                                height: 56,
                                                borderRadius: 8,
                                                border: "1px solid #2b2b2b",
                                                background: "#1b1b1b"
                                            }}
                                        />
                                    )}
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
