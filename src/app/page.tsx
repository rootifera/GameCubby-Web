import Link from "next/link";
import type { Route } from "next";
import type { CSSProperties, ReactNode } from "react";
import { API_BASE_URL } from "@/lib/env";
import { redirect } from "next/navigation";
import ForceRefreshButton from "@/components/ForceRefreshButton";
import { isJwtActive, readToken } from "@/lib/auth";
import SearchBox from "@/components/SearchBox";
import PageIntro from "@/components/PageIntro";

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
    background: "var(--gc-surface)",
    border: "1px solid var(--gc-border)",
    borderRadius: 16,
    padding: 22,
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
    borderTop: "1px solid var(--gc-border-subtle)",
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
async function checkIfAdmin(): Promise<boolean> {
    try {
        const token = await readToken();
        return token ? isJwtActive(token) : false;
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
    const isAdmin = await checkIfAdmin();

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
        <div className="gc-dashboard">
            <div className="gc-dashboard-intro">
                <PageIntro eyebrow="Your collection" title="Overview" description="Your collection at a glance.">
                    <SearchBox placeholder="Find a game…" />
                </PageIntro>
            </div>

            {error ? (
                <div style={errBox}>
                    Failed to load statistics.
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>{error}</div>
                </div>
            ) : null}

            {/* Consistent spacing wrapper for all sections */}
            <div className="gc-dashboard-grid">
                {/* Stat cards */}
                <section className="gc-dashboard-stats"
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
                <section className="gc-dashboard-health" style={panel}>
                    <header className="gc-health-header">
                        <h2>Library Health</h2>
                        <div className="gc-health-heading-actions">
                            <strong className={totalIssues === 0 ? "gc-health-status is-clear" : "gc-health-status"}>{totalIssues === 0 ? "All clear" : `${totalIssues} issue${totalIssues === 1 ? "" : "s"}`}</strong>
                            {isAdmin && <ForceRefreshButton />}
                        </div>
                    </header>
                    <div className="gc-health-checks">
                        {healthItems.map((h) => (
                            h.value > 0 ? (
                                <Link key={h.type} href={`/stats/health/${h.type}`} className="gc-health-check"><span><small>Needs attention</small>{h.label}</span><strong>{h.value}</strong><em>Review</em></Link>
                            ) : (
                                <div key={h.type} className="gc-health-check is-complete"><span><small>Complete</small>{h.label}</span><strong>0</strong></div>
                            )
                        ))}
                    </div>
                </section>

                <DashboardSection title="Library breakdown">
                    <DashboardPanel title="Top Platforms" style={panel}>
                        {topPlatforms.length ? <DistributionChart label="platform entries" rows={topPlatforms.map((p) => ({ label: p.name, value: p.count, key: String(p.platform_id), href: `/search?platform_id=${p.platform_id}` }))} /> : <EmptyStats label="No platform data yet." />}
                    </DashboardPanel>
                    <DashboardPanel title="Top Genres" style={panel}>
                        {topGenres.length ? <DistributionChart label="genre entries" rows={topGenres.map((g) => ({ label: g.name, value: g.count, key: String(g.genre_id), href: `/search/advanced?genre_ids=${g.genre_id}` }))} /> : <EmptyStats label="No genre data." />}
                    </DashboardPanel>
                </DashboardSection>

                <DashboardSection title="Catalog metadata" compact>
                    <DashboardPanel title="Publishers" style={panel}>
                        {topPublishers.length ? <SimpleList rows={topPublishers.map((c) => ({ left: c.name, right: String(c.count), key: String(c.company_id), href: `/search/advanced?company_ids=${c.company_id}` }))} /> : <EmptyStats label="No publisher data." />}
                    </DashboardPanel>
                    <DashboardPanel title="Developers" style={panel}>
                        {topDevelopers.length ? <SimpleList rows={topDevelopers.map((c) => ({ left: c.name, right: String(c.count), key: String(c.company_id), href: `/search/advanced?company_ids=${c.company_id}` }))} /> : <EmptyStats label="No developer data." />}
                    </DashboardPanel>
                    <DashboardPanel title="Years with most games" style={panel}>
                        {topYears.length ? <SimpleList rows={topYears.map((year) => ({ left: String(year.year), right: String(year.count), key: String(year.year), href: `/search?year=${year.year}` }))} /> : <EmptyStats label="No year data." />}
                    </DashboardPanel>
                </DashboardSection>

                <DashboardSection title="Ratings">
                    <DashboardPanel title="Highest rated" style={panel}>
                        <RatingList games={highestRated} emptyLabel="No rating data." />
                    </DashboardPanel>
                    <DashboardPanel title="Lowest rated" style={panel}>
                        <RatingList games={lowestRated} emptyLabel="No rating data." />
                    </DashboardPanel>
                </DashboardSection>
            </div>
        </div>
    );
}

/** ---------- Small building blocks ---------- */

function StatCard({ label, value }: { label: string; value: number | string }) {
    return (
        <div className="gc-stat-card">
            <div style={{ opacity: 0.8, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
        </div>
    );
}

function DashboardSection({ title, compact = false, children }: { title: string; compact?: boolean; children: ReactNode }) {
    return <section className={`gc-dashboard-section${compact ? " is-compact" : ""}`}>
        <header><h2>{title}</h2></header>
        <div className="gc-dashboard-section-grid">{children}</div>
    </section>;
}

function DashboardPanel({ title, style, children }: { title: string; style: CSSProperties; children: ReactNode }) {
    return <section className="gc-dashboard-panel" style={style}>
        <h3>{title}</h3>
        {children}
    </section>;
}

function EmptyStats({ label }: { label: string }) {
    return <p className="gc-dashboard-empty">{label}</p>;
}

function DistributionChart({ label, rows }: { label: string; rows: Array<{ label: string; value: number; key: string; href?: string }> }) {
    const palette = ["#729cff", "#66c2a5", "#f0b06b", "#bd8ee8", "#e47e99", "#7eb9dc"];
    const top = rows.slice(0, 5);
    const remaining = rows.slice(5).reduce((sum, row) => sum + row.value, 0);
    const entries = remaining > 0 ? [...top, { label: "Other", value: remaining, key: "other" }] : top;
    const total = entries.reduce((sum, entry) => sum + entry.value, 0);
    let cursor = 0;
    const slices = entries.map((entry, index) => {
        const start = cursor;
        cursor += total ? (entry.value / total) * 100 : 0;
        return `${palette[index]} ${start}% ${cursor}%`;
    });

    return <div className="gc-distribution-chart">
        <div className="gc-donut" style={{ backgroundImage: `conic-gradient(${slices.join(", ")})` }} role="img" aria-label={`${total} ${label} across ${entries.length} categories`} />
        <ul className="gc-distribution-legend">
            {entries.map((entry, index) => <li key={entry.key}>
                <i style={{ backgroundColor: palette[index] }} aria-hidden="true" />
                {entry.href ? <Link href={entry.href as Route} className="gc-dashboard-row-link">{entry.label}</Link> : <span>{entry.label}</span>}
                <strong>{entry.value}</strong>
            </li>)}
        </ul>
    </div>;
}

function RatingList({ games, emptyLabel }: { games: Array<{ game_id: number; igdb_id: number; name: string; rating: number | null }>; emptyLabel: string }) {
    if (!games.length) return <EmptyStats label={emptyLabel} />;
    return <ul style={listReset}>
        {games.slice(0, 5).map((game) => (
            <li key={game.game_id} style={rowItem}>
                <Link href={`/games/${game.game_id}`} style={{ color: "var(--gc-text)", textDecoration: "none" }} title={`IGDB: ${game.igdb_id}`}>{game.name}</Link>
                <span style={{ opacity: 0.85 }}>{game.rating ?? "—"}</span>
            </li>
        ))}
    </ul>;
}

function SimpleList({ rows }: { rows: Array<{ left: string; right: string; key: string; href?: string }> }) {
    return (
        <ul style={listReset}>
            {rows.map((r) => (
                <li key={r.key} style={rowItem}>
                    {r.href ? <Link href={r.href as Route} className="gc-dashboard-row-link">{r.left}</Link> : <span>{r.left}</span>}
                    <span style={{ opacity: 0.85 }}>{r.right}</span>
                </li>
            ))}
        </ul>
    );
}
