import Link from "next/link";
import { API_BASE_URL } from "@/lib/env";
import SearchBox from "@/components/SearchBox";

/** Shape we expect back; coded defensively since the schema is loose */
type GameLike = {
    id: number;
    name: string;
    cover_url?: string | null;
    release_date?: number | null;
    platforms?: Array<{ id: number; name: string }>;
    rating?: number | null;
};

function toYearLabel(n?: number | null): string {
    if (n == null) return "—";
    if (n >= 1000 && n <= 3000) return String(n);
    if (n >= 1_000_000_000_000) return String(new Date(n).getUTCFullYear());
    if (n >= 1_000_000_000) return String(new Date(n * 1000).getUTCFullYear());
    return String(n);
}

async function searchByName(q: string): Promise<GameLike[]> {
    const url = `${API_BASE_URL}/search/basic?name=${encodeURIComponent(q)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
    const data = await res.json();
    const list: unknown = (Array.isArray(data) ? data : (data as any)?.results ?? []) as unknown;
    return Array.isArray(list) ? (list as GameLike[]) : [];
}

export default async function SearchPage({
                                             searchParams
                                         }: {
    searchParams?: { q?: string };
}) {
    const q = (searchParams?.q ?? "").trim();
    let results: GameLike[] = [];
    let error: string | null = null;

    if (q) {
        try {
            results = await searchByName(q);
        } catch (e: unknown) {
            error = e instanceof Error ? e.message : "Unknown error";
        }
    }

    return (
        <div style={{ padding: 16 }}>
            <div style={{ marginBottom: 12 }}>
                <Link href="/" style={{ color: "#a0c4ff", textDecoration: "none" }}>
                    ← Back to Home
                </Link>
            </div>

            <h1 style={{ fontSize: 24, margin: "0 0 12px 0" }}>Search</h1>

            {/* Tabs: Basic / Advanced */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <span
            style={{
                padding: "8px 12px",
                borderRadius: 8,
                background: "#1e293b",
                border: "1px solid #3b82f6",
                color: "#fff",
                fontWeight: 600
            }}
        >
          Basic
        </span>
                <Link
                    href="/search/advanced"
                    style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        background: "#111",
                        border: "1px solid #2b2b2b",
                        color: "#d8d8d8",
                        textDecoration: "none"
                    }}
                >
                    Advanced
                </Link>
            </div>

            {/* Autocomplete search box (submits GET /search?q=...) */}
            <div style={{ marginBottom: 16 }}>
                <SearchBox defaultValue={q} />
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
                    Failed to search.
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>{error}</div>
                </div>
            ) : null}

            {!q ? (
                <p style={{ opacity: 0.8 }}>Type a name and pick a suggestion or press Enter.</p>
            ) : !results.length && !error ? (
                <p style={{ opacity: 0.8 }}>No results for “{q}”.</p>
            ) : null}

            {results.length ? (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {results.map((g) => (
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

                            {/* Info */}
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
                                    <div>Rating: {g.rating ?? "—"}</div>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    );
}
