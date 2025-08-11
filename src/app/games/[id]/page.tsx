import Link from "next/link";
import { API_BASE_URL } from "@/lib/env";

type LocationNode = { id: string; name: string };

type Named = { id: number; name: string };
type CompanyRole = {
    company: Named;
    developer: boolean;
    publisher: boolean;
    porting: boolean;
    supporting: boolean;
};

type Game = {
    id: number;
    igdb_id: number;
    name: string;
    summary?: string | null;
    release_date?: number | null;
    cover_url?: string | null;
    condition?: number | null;
    order?: number | null;
    rating?: number | null;
    platforms?: Named[];
    tags?: Named[];
    genres?: Named[];
    modes?: Named[];
    playerperspectives?: Named[];
    collection?: Named | null;
    companies?: CompanyRole[];
    igdb_tags?: Named[];
    location_path?: LocationNode[];
};

async function fetchGame(id: string): Promise<Game> {
    const url = `${API_BASE_URL}/games/${id}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
    return (await res.json()) as Game;
}

/* helpers */
function toYear(n?: number | null): string {
    if (n == null) return "—";
    if (n >= 1000 && n <= 3000) return String(n);
    if (n >= 1_000_000_000_000) return String(new Date(n).getUTCFullYear());
    if (n >= 1_000_000_000) return String(new Date(n * 1000).getUTCFullYear());
    return String(n);
}

function isValidHttpUrl(s?: string | null): s is string {
    if (!s) return false;
    const t = s.trim();
    if (!t) return false;
    try {
        const u = new URL(t);
        return u.protocol === "http:" || u.protocol === "https:";
    } catch {
        return false;
    }
}

// We don't have the IGDB slug, so link to a site search by name (reliable).
function igdbSearchUrl(name: string) {
    return `https://www.igdb.com/search?q=${encodeURIComponent(name)}`;
}

export default async function GameDetailsPage({ params }: { params: { id: string } }) {
    let game: Game | null = null;
    let error: string | null = null;

    try {
        game = await fetchGame(params.id);
    } catch (e: unknown) {
        error = e instanceof Error ? e.message : "Unknown error";
    }

    return (
        <div style={{ padding: 16 }}>
            <div style={{ marginBottom: 16 }}>
                <Link href="/games" style={{ color: "#a0c4ff", textDecoration: "none" }}>
                    ← Back to Games
                </Link>
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
                    Failed to load game.
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>{error}</div>
                </div>
            ) : null}

            {!error && game && (
                <article
                    style={{
                        display: "grid",
                        gridTemplateColumns: "180px 1fr",
                        gap: 18,
                        alignItems: "start",
                        background: "#111",
                        border: "1px solid #262626",
                        borderRadius: 12,
                        padding: 16
                    }}
                >
                    {/* Cover */}
                    <div>
                        {isValidHttpUrl(game.cover_url) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={game.cover_url!.trim()}
                                alt={game.name}
                                width={180}
                                height={228}
                                style={{
                                    width: 180,
                                    height: 228,
                                    objectFit: "cover",
                                    borderRadius: 10,
                                    border: "1px solid #2b2b2b",
                                    background: "#141414"
                                }}
                            />
                        ) : (
                            <div
                                style={{
                                    width: 180,
                                    height: 228,
                                    background: "#2b2b2b",
                                    borderRadius: 10,
                                    border: "1px solid #2b2b2b"
                                }}
                            />
                        )}
                    </div>

                    {/* Info */}
                    <div>
                        <h1 style={{ fontSize: 26, margin: "0 0 10px 0", letterSpacing: 0.2 }}>{game.name}</h1>

                        {/* Quick facts */}
                        <div
                            style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 8,
                                fontSize: 14,
                                opacity: 0.95,
                                marginBottom: 12
                            }}
                        >
                            <Pill label={`Year: ${toYear(game.release_date)}`} />
                            <Pill label={`Rating: ${typeof game.rating === "number" ? game.rating : "—"}`} />
                            <Pill label={`Condition: ${game.condition ?? "—"}`} />

                            {/* IGDB pill becomes a link; keeps the ID visible */}
                            <a
                                href={igdbSearchUrl(game.name)}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    textDecoration: "none",
                                    background: "#1d1d1d",
                                    border: "1px solid #2b2b2b",
                                    borderRadius: 999,
                                    padding: "4px 10px",
                                    lineHeight: 1.2,
                                    color: "#eaeaea"
                                }}
                                title="Open on IGDB (search by name)"
                            >
                                IGDB: {game.igdb_id}
                            </a>
                        </div>

                        {/* Location (with Order) */}
                        <section
                            style={{
                                margin: "10px 0 14px 0",
                                padding: "10px 12px",
                                background: "#141414",
                                border: "1px solid #262626",
                                borderRadius: 10
                            }}
                        >
                            <div style={{ fontWeight: 600, marginBottom: 6 }}>Location:</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                                {game.location_path && game.location_path.length ? (
                                    <>
                                        {game.location_path.map((node, idx) => (
                                            <span key={node.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                <span
                                                    style={{
                                                        background: "#1e1e1e",
                                                        border: "1px solid #2b2b2b",
                                                        borderRadius: 999,
                                                        padding: "4px 10px",
                                                        fontSize: 12
                                                    }}
                                                >
                                                    {node.name}
                                                </span>
                                                {idx < game.location_path!.length - 1 ? (
                                                    <span style={{ opacity: 0.6 }}>›</span>
                                                ) : null}
                                            </span>
                                        ))}
                                    </>
                                ) : (
                                    <span style={{ opacity: 0.7 }}>Not set</span>
                                )}

                                {/* Order appended at the end */}
                                {typeof game.order === "number" ? (
                                    <>
                                        <span style={{ opacity: 0.6 }}>·</span>
                                        <span
                                            style={{
                                                background: "#1e1e1e",
                                                border: "1px solid #2b2b2b",
                                                borderRadius: 999,
                                                padding: "4px 10px",
                                                fontSize: 12
                                            }}
                                        >
                                            Order: {game.order}
                                        </span>
                                    </>
                                ) : null}
                            </div>
                        </section>

                        {/* Summary */}
                        {game.summary ? (
                            <p style={{ lineHeight: 1.55, opacity: 0.95, marginBottom: 14 }}>{game.summary}</p>
                        ) : (
                            <p style={{ opacity: 0.6 }}>No summary.</p>
                        )}

                        {/* Structured metadata sections */}
                        <MetaRow label="Platforms" items={game.platforms?.map((x) => x.name)} />
                        <MetaRow label="Collection" items={game.collection ? [game.collection.name] : []} />
                        <MetaRow label="Genres" items={game.genres?.map((x) => x.name)} />
                        <MetaRow label="Modes" items={game.modes?.map((x) => x.name)} />
                        <MetaRow label="Perspectives" items={game.playerperspectives?.map((x) => x.name)} />
                        <MetaRow label="Tags" items={game.tags?.map((x) => x.name)} />
                        <MetaRow label="IGDB Tags" items={game.igdb_tags?.map((x) => x.name)} />
                        {game.companies && game.companies.length ? (
                            <MetaRow
                                label="Companies"
                                items={game.companies.map((c) => {
                                    const roles = [
                                        c.developer ? "dev" : "",
                                        c.publisher ? "pub" : "",
                                        c.porting ? "port" : "",
                                        c.supporting ? "supp" : ""
                                    ]
                                        .filter(Boolean)
                                        .join("/");
                                    return roles ? `${c.company.name} (${roles})` : c.company.name;
                                })}
                            />
                        ) : null}
                    </div>
                </article>
            )}
        </div>
    );
}

function Pill({ label }: { label: string }) {
    return (
        <span
            style={{
                background: "#1d1d1d",
                border: "1px solid #2b2b2b",
                borderRadius: 999,
                padding: "4px 10px",
                lineHeight: 1.2
            }}
        >
            {label}
        </span>
    );
}

function MetaRow({ label, items }: { label: string; items?: string[] }) {
    if (!items || items.length === 0) return null;
    return (
        <div style={{ margin: "10px 0" }}>
            <div style={{ opacity: 0.8, marginBottom: 4, fontWeight: 600 }}>{label}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {items.map((txt, i) => (
                    <span
                        key={`${label}-${i}-${txt}`}
                        style={{
                            background: "#1e1e1e",
                            border: "1px solid #2b2b2b",
                            borderRadius: 8,
                            padding: "4px 8px",
                            fontSize: 13
                        }}
                    >
                        {txt}
                    </span>
                ))}
            </div>
        </div>
    );
}
