import { API_BASE_URL } from "@/lib/env";
import { redirect } from "next/navigation";

type GamePreview = { id: number; platforms?: Array<{ id: number; name: string }> };
type Named = { id: number; name: string };

/** Check first-run status. API returns plain "true" or "false". */
async function isFirstRunDone(): Promise<boolean> {
    try {
        const res = await fetch(`${API_BASE_URL}/first_run/status`, { cache: "no-store" });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const text = (await res.text()).trim().toLowerCase();
        if (text === "true") return true;
        if (text === "false") return false;

        // Be defensive: if backend ever returns JSON like { done: true }
        try {
            const parsed = JSON.parse(text);
            if (typeof parsed?.done === "boolean") return parsed.done;
        } catch {
            /* ignore */
        }
        // Unknown format -> assume configured so we don't block usage
        return true;
    } catch {
        // On network/API error, fail open (assume done) so users can still use the app
        return true;
    }
}

async function fetchJSON<T>(path: string): Promise<T> {
    const url = `${API_BASE_URL}${path}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
    return (await res.json()) as T;
}

export default async function HomePage() {
    // 1) If setup not completed, redirect to /setup
    const done = await isFirstRunDone();
    if (!done) {
        redirect("/setup");
    }

    // 2) Otherwise render overview + stats
    let totalGames = 0;
    let platformsCount = 0;
    let tagsCount = 0;
    let collectionsCount = 0;
    let topPlatforms: Array<{ id: number; name: string; count: number }> = [];
    let error: string | null = null;

    try {
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

        // Build platform counts from games list
        const counts = new Map<number, { id: number; name: string; count: number }>();
        for (const g of games ?? []) {
            for (const p of g.platforms ?? []) {
                const prev = counts.get(p.id);
                if (prev) prev.count += 1;
                else counts.set(p.id, { id: p.id, name: p.name, count: 1 });
            }
        }

        topPlatforms = Array.from(counts.values())
            .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
            .slice(0, 10);
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

            {/* Stat cards */}
            <section
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 12,
                    marginBottom: 16
                }}
            >
                <StatCard label="Total Games" value={totalGames} />
                <StatCard label="Platforms" value={platformsCount} />
                <StatCard label="Tags" value={tagsCount} />
                <StatCard label="Collections" value={collectionsCount} />
            </section>

            {/* Top Platforms */}
            <section
                style={{
                    background: "#111",
                    border: "1px solid #262626",
                    borderRadius: 12,
                    padding: 16
                }}
            >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <h2 style={{ fontSize: 18, margin: 0 }}>Top Platforms</h2>
                    <span style={{ opacity: 0.7, fontSize: 12 }}>
            showing up to {topPlatforms.length} of {platformsCount}
          </span>
                </div>

                {topPlatforms.length === 0 ? (
                    <p style={{ opacity: 0.7, marginTop: 10 }}>No platform data yet.</p>
                ) : (
                    <ul style={{ listStyle: "none", padding: 0, marginTop: 12 }}>
                        {topPlatforms.map((p) => (
                            <li
                                key={p.id}
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr auto",
                                    gap: 8,
                                    padding: "10px 8px",
                                    borderTop: "1px solid #1f1f1f"
                                }}
                            >
                                <span>{p.name}</span>
                                <span style={{ opacity: 0.85 }}>
                  {p.count} {p.count === 1 ? "game" : "games"}
                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <p style={{ opacity: 0.7, marginTop: 16, fontSize: 12 }}>
                (Next ideas: games by year, by location, most common tags, top collections.)
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
