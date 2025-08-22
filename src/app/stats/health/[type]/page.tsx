import Link from "next/link";
import { API_BASE_URL } from "@/lib/env";
import CoverThumb from "@/components/CoverThumb";
import GameHoverCard from "@/components/GameHoverCard";
import { notFound } from "next/navigation";

/** Types for the health stats endpoints */
type IdList = {
    ids: number[];
    count: number;
};

type GamePreview = {
    id: number;
    name: string;
    cover_url?: string | null;
    release_date?: number | null;
    platforms?: Array<{ id: number; name: string }>;
    rating?: number | null;
};

/** Valid health issue types */
const VALID_TYPES = ["cover", "release_year", "platform", "location", "tag"] as const;
type HealthType = typeof VALID_TYPES[number];

/** Health type metadata */
const HEALTH_TYPE_METADATA: Record<HealthType, { title: string; description: string; endpoint: string }> = {
    cover: {
        title: "Missing Cover Images",
        description: "Games that are missing cover images",
        endpoint: "/stats/health/cover"
    },
    release_year: {
        title: "Missing Release Years",
        description: "Games that are missing release year information",
        endpoint: "/stats/health/release_year"
    },
    platform: {
        title: "Missing Platforms",
        description: "Games that have no platform information",
        endpoint: "/stats/health/platform"
    },
    location: {
        title: "Missing Locations",
        description: "Games that have no location assigned",
        endpoint: "/stats/health/location"
    },
    tag: {
        title: "Missing Tags",
        description: "Games that have no tags assigned",
        endpoint: "/stats/health/tag"
    }
};

/** Fetch game IDs with the specified health issue */
async function fetchHealthIssueIds(type: HealthType): Promise<IdList> {
    const res = await fetch(`${API_BASE_URL}${HEALTH_TYPE_METADATA[type].endpoint}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`GET ${HEALTH_TYPE_METADATA[type].endpoint} -> ${res.status} ${res.statusText}`);
    return (await res.json()) as IdList;
}

/** Fetch game details for the given IDs */
async function fetchGamesByIds(ids: number[]): Promise<GamePreview[]> {
    if (ids.length === 0) return [];
    
    const results = await Promise.all(
        ids.map(async (id) => {
            try {
                const res = await fetch(`${API_BASE_URL}/games/${id}`, { cache: "no-store" });
                if (!res.ok) throw new Error();
                const game = (await res.json()) as GamePreview;
                return game;
            } catch {
                // Return a minimal game object if fetch fails
                return { id, name: `Game ${id} (Failed to load)`, cover_url: null, release_date: null, platforms: [], rating: null };
            }
        })
    );
    
    return results.filter(Boolean);
}

/** Year helper */
function toYearLabel(n?: number | null): string {
    if (n == null) return "—";
    if (n >= 1000 && n <= 3000) return String(n);
    if (n >= 1_000_000_000_000) return String(new Date(n).getUTCFullYear());
    if (n >= 1_000_000_000) return String(new Date(n * 1000).getUTCFullYear());
    return String(n);
}

export default async function HealthIssuePage({ params }: { params: { type: string } }) {
    const type = params.type as HealthType;
    
    // Validate the type parameter
    if (!VALID_TYPES.includes(type)) {
        notFound();
    }
    
    const metadata = HEALTH_TYPE_METADATA[type];
    let healthData: IdList | null = null;
    let games: GamePreview[] = [];
    let error: string | null = null;
    
    try {
        healthData = await fetchHealthIssueIds(type);
        if (healthData.ids.length > 0) {
            games = await fetchGamesByIds(healthData.ids);
        }
    } catch (e: unknown) {
        error = e instanceof Error ? e.message : "Unknown error loading health data";
    }
    
    return (
        <div>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <Link href="/" style={{ color: "#a0c4ff", textDecoration: "none" }}>← Overview</Link>
                <h1 style={{ fontSize: 24, margin: 0 }}>{metadata.title}</h1>
            </div>
            
            {/* Description */}
            <div style={{ marginBottom: 16, opacity: 0.8 }}>
                {metadata.description}
            </div>
            
            {error ? (
                <div style={errBox}>
                    Failed to load health data.
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>{error}</div>
                </div>
            ) : null}
            
            {/* Summary */}
            {healthData && (
                <div style={summaryBox}>
                    <strong>{healthData.count}</strong> game{healthData.count === 1 ? "" : "s"} found with this issue
                </div>
            )}
            
            {/* Games list */}
            {!error && games.length > 0 ? (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {games.map((g) => {
                        const year = toYearLabel(g.release_date);
                        const platformNames = g.platforms?.map((p) => p.name).join(", ") || "—";
                        
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
                                {/* Cover with hover card */}
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
                                
                                {/* Text block */}
                                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 4, width: "100%" }}>
                                    <div>
                                        <Link href={`/games/${g.id}`} style={{ color: "#fff", textDecoration: "none", fontWeight: 600 }}>
                                            {g.name}
                                        </Link>
                                        <div style={{ fontSize: 12, opacity: 0.8 }}>Platforms: {platformNames}</div>
                                    </div>
                                    
                                    {/* Right aligned meta */}
                                    <div style={{ textAlign: "right", fontSize: 12, opacity: 0.9 }}>
                                        <div>Year: {year}</div>
                                        <div>Rating: {g.rating ?? "—"}</div>
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            ) : !error && healthData?.count === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px", opacity: 0.7 }}>
                    <p>No games found with this issue! 🎉</p>
                    <p style={{ fontSize: 14, marginTop: 8 }}>All games have proper {type === "cover" ? "cover images" : type === "release_year" ? "release years" : type === "platform" ? "platforms" : type === "location" ? "locations" : "tags"}.</p>
                </div>
            ) : null}
        </div>
    );
}

/** Styles */
const errBox: React.CSSProperties = {
    background: "#3b0f12",
    border: "1px solid #5b1a1f",
    color: "#ffd7d7",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
};

const summaryBox: React.CSSProperties = {
    background: "#1e293b",
    border: "1px solid #3b82f6",
    color: "#dbeafe",
    padding: "12px 16px",
    borderRadius: 8,
    marginBottom: 16,
    textAlign: "center",
};
