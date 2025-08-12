// src/app/page.tsx
import { API_BASE_URL } from "@/lib/env";
import { redirect } from "next/navigation";

/* ------------ types ------------ */
type Named = { id: number; name: string };

type GamePreview = {
    id: number;
    name: string;
    release_date?: number | null;
    platforms?: Array<{ id: number; name: string }>;
};

type GameDetailForCounts = {
    id: number;
    genres?: Named[];
    companies?: Array<{ company: Named }>;
};

/* ------------ helpers ------------ */

function toYearNumber(n?: number | null): number | null {
    if (n == null) return null;
    if (n >= 1000 && n <= 3000) return n;
    if (n >= 1_000_000_000_000) return new Date(n).getUTCFullYear(); // ms
    if (n >= 1_000_000_000) return new Date(n * 1000).getUTCFullYear(); // sec
    return n;
}

async function isFirstRunDone(): Promise<boolean> {
    try {
        const res = await fetch(`${API_BASE_URL}/first_run/status`, { cache: "no-store" });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const text = (await res.text()).trim().toLowerCase();
        if (text === "true") return true;
        if (text === "false") return false;

        // If backend ever returns JSON like { done: true }
        try {
            const parsed = JSON.parse(text);
            if (typeof parsed?.done === "boolean") return parsed.done;
        } catch {
            /* ignore */
        }
        return true;
    } catch {
        // Fail open so users can still use the app
        return true;
    }
}

async function fetchJSON<T>(path: string): Promise<T> {
    const url = `${API_BASE_URL}${path}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
    return (await res.json()) as T;
}

/**
 * Fetch a subset (or all) game details in small batches to aggregate
 * companies and genres. Keeps it light by only reading needed fields.
 */
async function fetchDetailsForCounts(
    gameIds: number[],
    maxToScan = 400,
    batchSize = 25
): Promise<GameDetailForCounts[]> {
    const ids = gameIds.slice(0, Math.max(1, maxToScan));
    const details: GameDetailForCounts[] = [];

    for (let i = 0; i < ids.length; i += batchSize) {
        const chunk = ids.slice(i, i + batchSize);
        const chunkDetails = await Promise.all(
            chunk.map(async (id) => {
                // We’ll receive the full Game, but we only read genres/companies
                const d = await fetchJSON<GameDetailForCounts>(`/games/${id}`);
                return {
                    id: d.id,
                    genres: d.genres ?? [],
                    companies: d.companies ?? [],
                };
            })
        );
        details.push(...chunkDetails);
    }

    return details;
}

/* ------------ page ------------ */

export default async function HomePage() {
    // 1) Setup redirect if needed
    const done = await isFirstRunDone();
    if (!done) {
        redirect("/setup");
    }

    // 2) Overview data
    let totalGames = 0;
    let topPlatforms: Array<{ id: number; name: string; count: number }> = [];
    let releaseMin: number | null = null;
    let releaseMax: number | null = null;

    // New: Top-3 companies/genres
    let topCompanies: Array<{ id: number; name: string; count: number }> = [];
    let topGenres: Array<{ id: number; name: string; count: number }> = [];

    let error: string | null = null;

    try {
        const games = await fetchJSON<GamePreview[]>("/games/");

        const list = Array.isArray(games) ? games : [];
        totalGames = list.length;

        // Release range
        const years: number[] = [];
        for (const g of list) {
            const y = toYearNumber(g.release_date);
            if (y != null) years.push(y);
        }
        if (years.length) {
            releaseMin = Math.min(...years);
            releaseMax = Math.max(...years);
        }

        // Top platforms (from preview list)
        const pCounts = new Map<number, { id: number; name: string; count: number }>();
        for (const g of list) {
            for (const p of g.platforms ?? []) {
                const prev = pCounts.get(p.id);
                if (prev) prev.count += 1;
                else pCounts.set(p.id, { id: p.id, name: p.name, count: 1 });
            }
        }
        topPlatforms = Array.from(pCounts.values())
            .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
            .slice(0, 10);

        // Top companies & genres (fetch lightweight details, aggregate)
        if (totalGames > 0) {
            const ids = list.map((g) => g.id);
            const details = await fetchDetailsForCounts(ids);

            const cCounts = new Map<number, { id: number; name: string; count: number }>();
            const gCounts = new Map<number, { id: number; name: string; count: number }>();

            for (const d of details) {
                // Deduplicate per-game so a company/genre isn't double-counted within the same game
                const seenCompanyIds = new Set<number>();
                for (const c of d.companies ?? []) {
                    const cId = c?.company?.id;
                    const cName = c?.company?.name ?? "";
                    if (!cId || seenCompanyIds.has(cId)) continue;
                    seenCompanyIds.add(cId);

                    const prev = cCounts.get(cId);
                    if (prev) prev.count += 1;
                    else cCounts.set(cId, { id: cId, name: cName, count: 1 });
                }

                const seenGenreIds = new Set<number>();
                for (const gn of d.genres ?? []) {
                    if (!gn?.id || seenGenreIds.has(gn.id)) continue;
                    seenGenreIds.add(gn.id);

                    const prev = gCounts.get(gn.id);
                    if (prev) prev.count += 1;
                    else gCounts.set(gn.id, { id: gn.id, name: gn.name, count: 1 });
                }
            }

            topCompanies = Array.from(cCounts.values())
                .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
                .slice(0, 3);

            topGenres = Array.from(gCounts.values())
                .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
                .slice(0, 3);
        }
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
                        marginBottom: 16,
                    }}
                >
                    Failed to load statistics.
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>{error}</div>
                </div>
            ) : null}

            {/* Stat cards (only Total Games as requested) */}
            <section
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 12,
                    marginBottom: 16,
                }}
            >
                <StatCard label="Total Games" value={totalGames} />
                {/* Keep release range block compact and consistent */}
                <div
                    style={{
                        background: "#111",
                        border: "1px solid #262626",
                        borderRadius: 12,
                        padding: 16,
                    }}
                >
                    <div style={{ opacity: 0.8, marginBottom: 6 }}>Release Range</div>
                    <div style={{ fontSize: 18, fontWeight: 600 }}>
                        {releaseMin != null && releaseMax != null ? (
                            releaseMin === releaseMax ? (
                                <>{releaseMin}</>
                            ) : (
                                <>
                                    {releaseMin} – {releaseMax}
                                </>
                            )
                        ) : (
                            <>—</>
                        )}
                    </div>
                </div>
            </section>

            {/* Top Platforms */}
            <section
                style={{
                    background: "#111",
                    border: "1px solid #262626",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 16,
                }}
            >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <h2 style={{ fontSize: 18, margin: 0 }}>Top Platforms</h2>
                    <span style={{ opacity: 0.7, fontSize: 12 }}>
            showing up to {topPlatforms.length}
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
                                    borderTop: "1px solid #1f1f1f",
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

            {/* NEW: Top Companies (Top 3) + Top Genres (Top 3) */}
            <section
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                    gap: 12,
                    marginBottom: 16,
                }}
            >
                {/* Top Companies */}
                <div
                    style={{
                        background: "#111",
                        border: "1px solid #262626",
                        borderRadius: 12,
                        padding: 16,
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <h2 style={{ fontSize: 18, margin: 0 }}>Top Companies</h2>
                        <span style={{ opacity: 0.7, fontSize: 12 }}>top 3</span>
                    </div>

                    {topCompanies.length === 0 ? (
                        <p style={{ opacity: 0.7, marginTop: 10 }}>No company data yet.</p>
                    ) : (
                        <ul style={{ listStyle: "none", padding: 0, marginTop: 12 }}>
                            {topCompanies.map((c) => (
                                <li
                                    key={c.id}
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "1fr auto",
                                        gap: 8,
                                        padding: "10px 8px",
                                        borderTop: "1px solid #1f1f1f",
                                    }}
                                >
                                    <span>{c.name}</span>
                                    <span style={{ opacity: 0.85 }}>
                    {c.count} {c.count === 1 ? "game" : "games"}
                  </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Top Genres */}
                <div
                    style={{
                        background: "#111",
                        border: "1px solid #262626",
                        borderRadius: 12,
                        padding: 16,
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <h2 style={{ fontSize: 18, margin: 0 }}>Top Genres</h2>
                        <span style={{ opacity: 0.7, fontSize: 12 }}>top 3</span>
                    </div>

                    {topGenres.length === 0 ? (
                        <p style={{ opacity: 0.7, marginTop: 10 }}>No genre data yet.</p>
                    ) : (
                        <ul style={{ listStyle: "none", padding: 0, marginTop: 12 }}>
                            {topGenres.map((g) => (
                                <li
                                    key={g.id}
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "1fr auto",
                                        gap: 8,
                                        padding: "10px 8px",
                                        borderTop: "1px solid #1f1f1f",
                                    }}
                                >
                                    <span>{g.name}</span>
                                    <span style={{ opacity: 0.85 }}>
                    {g.count} {g.count === 1 ? "game" : "games"}
                  </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </section>

            <p style={{ opacity: 0.7, marginTop: 16, fontSize: 12 }}>
                (Next ideas: most common tags, top collections, games by location.)
            </p>
        </main>
    );
}

/* ------------ small components ------------ */

function StatCard({ label, value }: { label: string; value: number }) {
    return (
        <div
            style={{
                background: "#111",
                border: "1px solid #262626",
                borderRadius: 12,
                padding: 16,
            }}
        >
            <div style={{ opacity: 0.8, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
        </div>
    );
}
