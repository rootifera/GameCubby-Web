"use client";

import { useMemo } from "react";
import Link from "next/link";
import CoverThumb from "@/components/CoverThumb";
import GameHoverCard from "@/components/GameHoverCard";

interface GameLike {
    id: number;
    name: string;
    cover_url?: string | null;
    release_date?: number | null;
    platforms?: Array<{ id: number; name: string }>;
    rating?: number | null;
    order?: number;
}

interface SortableResultsProps {
    results: GameLike[];
    sortByOrder: boolean;
    locationId?: string;
}

function toYearLabel(n?: number | null): string {
    if (n == null) return "—";
    if (n >= 1000 && n <= 3000) return String(n);
    if (n >= 1_000_000_000_000) return String(new Date(n).getUTCFullYear());
    if (n >= 1_000_000_000) return String(new Date(n * 1000).getUTCFullYear());
    return String(n);
}

export function SortableResults({ results, sortByOrder, locationId }: SortableResultsProps) {
    const sortedResults = useMemo(() => {
        if (!sortByOrder || !locationId) return results;
        return [...results].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
    }, [results, sortByOrder, locationId]);

    return (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {sortedResults.map((g) => (
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
                    {/* Cover with hover card (56×56, robust placeholder) */}
                    <GameHoverCard gameId={g.id}>
                        <Link
                            href={`/games/${g.id}`}
                            style={{ display: "inline-block", flexShrink: 0 }}
                        >
                            <CoverThumb
                                name={g.name}
                                coverUrl={g.cover_url ?? undefined}
                                width={56}
                                height={56}
                            />
                        </Link>
                    </GameHoverCard>

                    {/* Info */}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr auto",
                            gap: 4,
                            width: "100%",
                        }}
                    >
                        <div>
                            <Link
                                href={`/games/${g.id}`}
                                style={{
                                    color: "#fff",
                                    textDecoration: "none",
                                    fontWeight: 600,
                                }}
                            >
                                {g.name}
                            </Link>
                            <div style={{ fontSize: 12, opacity: 0.8 }}>
                                Platforms:{" "}
                                {(g.platforms ?? []).map((p) => p.name).join(", ") || "—"}
                            </div>
                        </div>
                        <div
                            style={{ textAlign: "right", fontSize: 12, opacity: 0.9 }}
                        >
                            <div>Year: {toYearLabel(g.release_date)}</div>
                            <div>Rating: {g.rating ?? "—"}</div>
                        </div>
                    </div>
                </li>
            ))}
        </ul>
    );
}
