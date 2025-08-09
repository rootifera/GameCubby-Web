import { API_BASE_URL } from "@/lib/env";

type GamePreview = { id: number };
type Named = { id: number; name: string };

async function fetchJSON<T>(path: string): Promise<T> {
    const url = `${API_BASE_URL}${path}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
    return (await res.json()) as T;
}

export default async function HomePage() {
    let totalGames = 0;
    let platformsCount = 0;
    let tagsCount = 0;
    let collectionsCount = 0;
    let error: string | null = null;

    try {
        // Minimal, fast stats using existing endpoints
        const [games, platforms, tags, collections] = await Promise.all([
            fetchJSON<GamePreview[]>("/games/"),
            fetchJSON<Named[]>("/platforms/"),
            fetchJSON<Named[]>("/tags/"),
            fetchJSON<Named[]>("/collections/")
        ]);

        totalGames = Array.isArray(games) ? games.length : 0;
        platformsCount = Array.isArray(platforms) ? platforms.length : 0;
        tagsCount = Array.isArray(tags) ? tags.length : 0;
        collectionsCount = Array.isArray(collections) ? collections.length : 0;
    } catch (e: unknown) {
        error = e instanceof Error ? e.message : "Unknown error";
    }

    return (
        <main style={{ maxWidth: 1100, margin: "24px auto", padding: "0 16px" }}>
            <h1 style={{ fontSize: 24, margin: "0 0 16px 0" }}>Overview</h1>

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
                    Failed to load statistics.
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>{error}</div>
                </div>
            ) : null}

            <section
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 12
                }}
            >
                <StatCard label="Total Games" value={totalGames} />
                <StatCard label="Platforms" value={platformsCount} />
                <StatCard label="Tags" value={tagsCount} />
                <StatCard label="Collections" value={collectionsCount} />
            </section>

            <p style={{ opacity: 0.7, marginTop: 16, fontSize: 12 }}>
                (We’ll add richer stats later: games by platform, by year, by location, top collections, etc.)
            </p>
        </main>
    );
}

function StatCard({ label, value }: { label: string; value: number }) {
    return (
        <div
            style={{
                background: "#111",
                border: "1px solid #262626",
                borderRadius: 12,
                padding: 16
            }}
        >
            <div style={{ opacity: 0.8, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
        </div>
    );
}
