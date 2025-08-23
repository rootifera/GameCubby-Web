import Link from "next/link";
import { API_BASE_URL } from "@/lib/env";
import { redirect } from "next/navigation";
import ForceRefreshButton from "@/components/ForceRefreshButton";
import { cookies } from "next/headers";

/** ---------- Types from the endpoints ---------- */

type Overview = {
    total_games: number;
    total_games_unique: number;
    release_range?: { oldest_year?: number | null; newest_year?: number | null } | null;
    top_genres?: Array<{ genre_id: number; name: string; count: number }>;
    top_platforms?: Array<{ platform_id: number; name: string; count: number }>;
    top_publishers?: Array<{ company_id: number; name: string; count: number }>;
    top_developers?: Array<{ company_id: number; name: string; count: number }>;
    top_years?: Array<{ year: number; count: number }>;
    top_highest_rated?: Array<{ game_id: number; igdb_id: number; name: string; rating: number | null }>;
    top_lowest_rated?: Array<{ game_id: number; igdb_id: number; name: string; rating: number | null }>;
};

type Health = {
    missing_cover?: number;
    missing_release_year?: number;
    no_platforms?: number;
    no_location?: number;
    untagged?: number;
    total_games_unique?: number;
    total_games?: number;
};

/** ---------- Styles ---------- */
const panel: React.CSSProperties = {
    background: "#111",
    border: "1px solid #262626",
    borderRadius: 12,
    padding: 16,
};

const panelHeaderRow: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
};

const panelTitle: React.CSSProperties = { fontSize: 18, margin: 0 };

const listReset: React.CSSProperties = { listStyle: "none", padding: 0, margin: 0, marginTop: 12 };

const rowItem: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 8,
    padding: "10px 8px",
    borderTop: "1px solid #1f1f1f",
};

const errBox: React.CSSProperties = {
    background: "#3b0f12",
    border: "1px solid #5b1a1f",
    color: "#ffd7d7",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
};

/** ---------- First-run status (unchanged) ---------- */
async function isFirstRunDone(): Promise<boolean> {
    try {
        const res = await fetch(`${API_BASE_URL}/first_run/status`, { cache: "no-store" });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const text = (await res.text()).trim().toLowerCase();
        if (text === "true") return true;
        if (text === "false") return false;

        // Defensive: accept JSON { done: boolean } too
        try {
            const parsed = JSON.parse(text);
            if (typeof parsed?.done === "boolean") return parsed.done;
        } catch {
            /* ignore */
        }
        return true;
    } catch {
        // Fail open so users can still use the app if probe fails
        return true;
    }
}

/** ---------- API calls ---------- */
async function fetchOverview(): Promise<Overview> {
    const res = await fetch(`${API_BASE_URL}/stats/overview`, { cache: "no-store" });
    if (!res.ok) throw new Error(`GET /stats/overview -> ${res.status} ${res.statusText}`);
    return (await res.json()) as Overview;
}

async function fetchHealth(): Promise<Health> {
    const res = await fetch(`${API_BASE_URL}/stats/health`, { cache: "no-store" });
    if (!res.ok) throw new Error(`GET /stats/health -> ${res.status} ${res.statusText}`);
    return (await res.json()) as Health;
}

/** ---------- Check if user is admin ---------- */
function checkIfAdmin(): boolean {
    try {
        const token = cookies().get("__gcub_a")?.value || "";
        if (!token) return false;
        
        // Simple JWT expiration check (same logic as admin health endpoint)
        const parts = token.split(".");
        if (parts.length < 2) return false;
        const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
        const json = atob(b64 + pad);
        const payload = JSON.parse(json) as { exp?: number };
        if (typeof payload.exp !== "number") return true; // no exp -> treat as active
        const now = Math.floor(Date.now() / 1000);
        return payload.exp > now;
    } catch {
        return false;
    }
}

/** ---------- Page ---------- */
export default async function HomePage() {
    // Redirect to setup if first run not completed
    const done = await isFirstRunDone();
    if (!done) redirect("/setup");

    let overview: Overview | null = null;
    let health: Health | null = null;
    let error: string | null = null;
    const isAdmin = checkIfAdmin();

    try {
        [overview, health] = await Promise.all([fetchOverview(), fetchHealth()]);
    } catch (e: unknown) {
        error = e instanceof Error ? e.message : "Unknown error loading statistics.";
    }

    const totalGames = overview?.total_games ?? 0;
    const uniqueGames = overview?.total_games_unique ?? 0;
    const oldest = overview?.release_range?.oldest_year ?? null;
    const newest = overview?.release_range?.newest_year ?? null;

    const topPlatforms = overview?.top_platforms ?? [];
    const topGenres = overview?.top_genres ?? [];
    const topPublishers = overview?.top_publishers ?? [];
    const topDevelopers = overview?.top_developers ?? [];
    const topYears = overview?.top_years ?? [];
    const highestRated = overview?.top_highest_rated ?? [];
    const lowestRated = overview?.top_lowest_rated ?? [];

    const healthItems = [
        { label: "Untagged", value: health?.untagged ?? 0, type: "tag" },
        { label: "Missing release year", value: health?.missing_release_year ?? 0, type: "release_year" },
        { label: "No platforms", value: health?.no_platforms ?? 0, type: "platform" },
        { label: "No location", value: health?.no_location ?? 0, type: "location" },
        { label: "Missing cover", value: health?.missing_cover ?? 0, type: "cover" },
    ];
    const totalIssues = healthItems.reduce((sum, it) => sum + (it.value || 0), 0);

    return (
        // Match /search container rhythm: no custom maxWidth or top margin here.
        <div>
            {/* Top header (match /search) */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <h1 style={{ fontSize: 24, margin: 0 }}>Overview</h1>
            </div>

            {error ? (
                <div style={errBox}>
                    Failed to load statistics.
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>{error}</div>
                </div>
            ) : null}

            {/* Consistent spacing wrapper for all sections */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Stat cards */}
                <section
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: 12,
                    }}
                >
                    <StatCard label="Total Games" value={totalGames} />
                    <StatCard label="Unique Titles" value={uniqueGames} />
                    <StatCard
                        label="Release Range"
                        value={
                            oldest && newest
                                ? `${oldest}–${newest}`
                                : oldest
                                    ? `${oldest}–—`
                                    : newest
                                        ? `—–${newest}`
                                        : "—"
                        }
                    />
                </section>

                {/* Health snapshot (all fields) */}
                <section style={panel}>
                    <div style={panelHeaderRow}>
                        <h2 style={panelTitle}>Library Health</h2>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ opacity: 0.7, fontSize: 12 }}>
                                {totalIssues === 0 ? "All good 🎉" : `${totalIssues} issue${totalIssues === 1 ? "" : "s"}`}
                            </span>
                            {isAdmin && <ForceRefreshButton />}
                        </div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                        {healthItems.map((h) => (
                            <Badge 
                                key={h.label} 
                                label={`${h.label}: ${h.value}`} 
                                muted={h.value === 0} 
                                type={h.type}
                                count={h.value}
                            />
                        ))}
                    </div>
                </section>

                {/* Top Platforms (all returned) */}
                <section style={panel}>
                    <div style={panelHeaderRow}>
                        <h2 style={panelTitle}>Top Platforms</h2>
                        <span style={{ opacity: 0.7, fontSize: 12 }}>count by platform</span>
                    </div>
                    {topPlatforms.length === 0 ? (
                        <p style={{ opacity: 0.7, marginTop: 10 }}>No platform data yet.</p>
                    ) : (
                        <SimpleList
                            rows={topPlatforms.map((p) => ({
                                left: p.name,
                                right: `${p.count} ${p.count === 1 ? "game" : "games"}`,
                                key: String(p.platform_id),
                            }))}
                        />
                    )}
                </section>

                {/* Two-up: Top Genres / Top Publishers (show everything) */}
                <section
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                        gap: 12,
                    }}
                >
                    <div style={panel}>
                        <div style={panelHeaderRow}>
                            <h2 style={panelTitle}>Top Genres</h2>
                            <span style={{ opacity: 0.7, fontSize: 12 }}>count by genre</span>
                        </div>
                        {topGenres.length ? (
                            <SimpleList
                                rows={topGenres.map((g) => ({
                                    left: g.name,
                                    right: `${g.count}`,
                                    key: String(g.genre_id),
                                }))}
                            />
                        ) : (
                            <p style={{ opacity: 0.7, marginTop: 10 }}>No genre data.</p>
                        )}
                    </div>

                    <div style={panel}>
                        <div style={panelHeaderRow}>
                            <h2 style={panelTitle}>Top Publishers</h2>
                            <span style={{ opacity: 0.7, fontSize: 12 }}>count by publisher</span>
                        </div>
                        {topPublishers.length ? (
                            <SimpleList
                                rows={topPublishers.map((c) => ({
                                    left: c.name,
                                    right: `${c.count}`,
                                    key: String(c.company_id),
                                }))}
                            />
                        ) : (
                            <p style={{ opacity: 0.7, marginTop: 10 }}>No publisher data.</p>
                        )}
                    </div>
                </section>

                {/* Two-up: Top Developers / Top Years */}
                <section
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                        gap: 12,
                    }}
                >
                    <div style={panel}>
                        <div style={panelHeaderRow}>
                            <h2 style={panelTitle}>Top Developers</h2>
                            <span style={{ opacity: 0.7, fontSize: 12 }}>count by developer</span>
                        </div>
                        {topDevelopers.length ? (
                            <SimpleList
                                rows={topDevelopers.map((c) => ({
                                    left: c.name,
                                    right: `${c.count}`,
                                    key: String(c.company_id),
                                }))}
                            />
                        ) : (
                            <p style={{ opacity: 0.7, marginTop: 10 }}>No developer data.</p>
                        )}
                    </div>

                    <div style={panel}>
                        <div style={panelHeaderRow}>
                            <h2 style={panelTitle}>Years with Most Games</h2>
                            <span style={{ opacity: 0.7, fontSize: 12 }}>count by year</span>
                        </div>
                        {topYears.length ? (
                            <SimpleList
                                rows={topYears.map((y) => ({
                                    left: String(y.year),
                                    right: `${y.count}`,
                                    key: String(y.year),
                                }))}
                            />
                        ) : (
                            <p style={{ opacity: 0.7, marginTop: 10 }}>No year data.</p>
                        )}
                    </div>
                </section>

                {/* Highest / Lowest rated (all returned) */}
                <section
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                        gap: 12,
                        marginBottom: 12,
                    }}
                >
                    <div style={panel}>
                        <div style={panelHeaderRow}>
                            <h2 style={panelTitle}>Highest Rated</h2>
                            <span style={{ opacity: 0.7, fontSize: 12 }}>rating (IGDB)</span>
                        </div>
                        {highestRated.length ? (
                            <ul style={listReset}>
                                {highestRated.map((g) => (
                                    <li key={g.game_id} style={rowItem}>
                                        <Link
                                            href={`/games/${g.game_id}`}
                                            style={{ color: "#eaeaea", textDecoration: "none" }}
                                            title={`IGDB: ${g.igdb_id}`}
                                        >
                                            {g.name}
                                        </Link>
                                        <span style={{ opacity: 0.85 }}>{g.rating ?? "—"}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p style={{ opacity: 0.7, marginTop: 10 }}>No rating data.</p>
                        )}
                    </div>

                    <div style={panel}>
                        <div style={panelHeaderRow}>
                            <h2 style={panelTitle}>Lowest Rated</h2>
                            <span style={{ opacity: 0.7, fontSize: 12 }}>rating (IGDB)</span>
                        </div>
                        {lowestRated.length ? (
                            <ul style={listReset}>
                                {lowestRated.map((g) => (
                                    <li key={g.game_id} style={rowItem}>
                                        <Link
                                            href={`/games/${g.game_id}`}
                                            style={{ color: "#eaeaea", textDecoration: "none" }}
                                            title={`IGDB: ${g.igdb_id}`}
                                        >
                                            {g.name}
                                        </Link>
                                        <span style={{ opacity: 0.85 }}>{g.rating ?? "—"}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p style={{ opacity: 0.7, marginTop: 10 }}>No rating data.</p>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}

/** ---------- Small building blocks ---------- */

function StatCard({ label, value }: { label: string; value: number | string }) {
    return (
        <div style={panel}>
            <div style={{ opacity: 0.8, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
        </div>
    );
}

function Badge({ label, muted, type, count }: { label: string; muted?: boolean; type?: string; count?: number }) {
    const hasIssues = count && count > 0;
    
    if (muted || !hasIssues || !type) {
        return (
            <span
                style={{
                    background: muted ? "#1a1a1a" : "#1e293b",
                    border: `1px solid ${muted ? "#2b2b2b" : "#3b82f6"}`,
                    color: muted ? "#cfcfcf" : "#dbeafe",
                    padding: "6px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    whiteSpace: "nowrap",
                }}
            >
                {label}
            </span>
        );
    }
    
    return (
        <Link
            href={`/stats/health/${type}`}
            style={{
                background: "#1e293b",
                border: "1px solid #3b82f6",
                color: "#dbeafe",
                padding: "6px 10px",
                borderRadius: 999,
                fontSize: 12,
                whiteSpace: "nowrap",
                textDecoration: "none",
                display: "inline-block",
                cursor: "pointer",
                transition: "all 0.2s ease",
            }}
        >
            {label}
        </Link>
    );
}

function SimpleList({ rows }: { rows: Array<{ left: string; right: string; key: string }> }) {
    return (
        <ul style={listReset}>
            {rows.map((r) => (
                <li key={r.key} style={rowItem}>
                    <span>{r.left}</span>
                    <span style={{ opacity: 0.85 }}>{r.right}</span>
                </li>
            ))}
        </ul>
    );
}
