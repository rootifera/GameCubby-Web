import Link from "next/link";
import { API_BASE_URL } from "@/lib/env";
import SearchBox from "@/components/SearchBox";
import CoverThumb from "@/components/CoverThumb";
import GameHoverCard from "@/components/GameHoverCard";

type Named = { id: number; name: string };
type GamePreview = {
    id: number;
    name: string;
    cover_url?: string | null;
    release_date?: number | null;
    platforms?: Named[];
};

function toYearLabel(n?: number | null): string {
    if (n == null) return "—";
    if (n >= 1000 && n <= 3000) return String(n);
    if (n >= 1_000_000_000_000) return String(new Date(n).getUTCFullYear()); // ms
    if (n >= 1_000_000_000) return String(new Date(n * 1000).getUTCFullYear()); // sec
    return String(n);
}

async function runBasicSearch(name: string): Promise<GamePreview[]> {
    const qs = new URLSearchParams();
    if (name.trim()) qs.set("name", name.trim());
    const url = `${API_BASE_URL}/search/basic${qs.toString() ? `?${qs.toString()}` : ""}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
    const data = await res.json();
    return Array.isArray(data) ? (data as GamePreview[]) : (data?.results ?? []);
}

export default async function BasicSearchPage({
                                                  searchParams,
                                              }: {
    searchParams?: Record<string, string | string[] | undefined>;
}) {
    const sp = searchParams ?? {};
    // accept both ?q= and ?name=
    const q =
        (typeof sp.q === "string" ? sp.q : undefined) ??
        (typeof sp.name === "string" ? sp.name : "") ??
        "";

    let results: GamePreview[] = [];
    let error: string | null = null;

    if (q && q.trim()) {
        try {
            results = await runBasicSearch(q);
        } catch (e: unknown) {
            error = e instanceof Error ? e.message : "Unknown error";
        }
    }

    return (
        <div style={{ padding: 16 }}>
            <div style={{ marginBottom: 12, display: "flex", gap: 8 }}>
                <Link href="/" style={{ color: "#a0c4ff", textDecoration: "none" }}>
                    ← Home
                </Link>
                <span style={{ opacity: 0.6 }}>•</span>
                <Link href="/search/advanced" style={{ color: "#a0c4ff", textDecoration: "none" }}>
                    Advanced Search
                </Link>
            </div>

            <h1 style={{ fontSize: 24, margin: "0 0 12px 0" }}>Search</h1>

            {/* Search bar */}
            <div style={{ marginBottom: 16 }}>
                {/* SearchBox submits to /search with ?q= */}
                <SearchBox defaultValue={q || ""} />
            </div>

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
                    Failed to search.
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>{error}</div>
                </div>
            ) : null}

            {!q ? (
                <p style={{ opacity: 0.8 }}>Type at least 2 characters to search.</p>
            ) : results.length ? (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {results.map((g) => (
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
                            {/* Cover with hover card (56×56 thumb, robust placeholder) */}
                            <GameHoverCard gameId={g.id}>
                                <Link href={`/games/${g.id}`} style={{ display: "inline-block", flexShrink: 0 }}>
                                    <CoverThumb
                                        name={g.name}
                                        coverUrl={g.cover_url ?? undefined}
                                        width={56}
                                        height={56}
                                    />
                                </Link>
                            </GameHoverCard>

                            {/* Text */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 4, width: "100%" }}>
                                <div>
                                    <Link href={`/games/${g.id}`} style={{ color: "#fff", textDecoration: "none", fontWeight: 600 }}>
                                        {g.name}
                                    </Link>
                                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                                        Platforms: {(g.platforms ?? []).map((p) => p.name).join(", ") || "—"}
                                    </div>
                                </div>
                                <div style={{ textAlign: "right", fontSize: 12, opacity: 0.9 }}>
                                    <div>Year: {toYearLabel(g.release_date)}</div>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <p style={{ opacity: 0.8 }}>No results.</p>
            )}
        </div>
    );
}
