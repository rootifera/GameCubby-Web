"use client";

import { useEffect, useState } from "react";
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
    const [sortedResults, setSortedResults] = useState<GameLike[]>(results);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!sortByOrder || !locationId) {
            setSortedResults(results);
            return;
        }

        async function sortResults() {
            setIsLoading(true);
            try {
                // Fetch order information for each game
                const resultsWithOrder = await Promise.all(
                    results.map(async (game) => {
                        try {
                            const gameDetails = await fetch(`/api/proxy/games/${game.id}`, { 
                                cache: "no-store" 
                            });
                            if (gameDetails.ok) {
                                const details = await gameDetails.json();
                                return { ...game, order: details.order || 0 };
                            }
                        } catch (error) {
                            console.warn(`Failed to fetch order for game ${game.id}:`, error);
                        }
                        return { ...game, order: 0 };
                    })
                );

                // Sort by order (simple numeric sorting)
                const sorted = resultsWithOrder.sort((a, b) => {
                    const orderA = (a as any).order || 0;
                    const orderB = (b as any).order || 0;
                    return orderA - orderB;
                });

                setSortedResults(sorted);
            } catch (error) {
                console.error("Failed to sort by order:", error);
                setSortedResults(results);
            } finally {
                setIsLoading(false);
            }
        }

        sortResults();
    }, [results, sortByOrder, locationId]);

    if (isLoading) {
        return (
            <div style={{ textAlign: "center", padding: "20px", opacity: 0.7 }}>
                Sorting results by order...
            </div>
        );
    }

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
