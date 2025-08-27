"use client";

import { useEffect, useState, useCallback } from "react";
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
    const [sortedResults, setSortedResults] = useState<GameLike[]>(results);
    const [isLoading, setIsLoading] = useState(false);
    const [sortError, setSortError] = useState<string | null>(null);

    // Simple sorting function without useCallback to avoid dependency issues
    const sortResults = async () => {
        if (!sortByOrder || !locationId || results.length === 0) {
            console.log("Sorting skipped:", { sortByOrder, locationId, resultsLength: results.length });
            setSortedResults(results);
            setSortError(null);
            return;
        }

        console.log("Starting sort by order for", results.length, "games");
        setIsLoading(true);
        setSortError(null);

        try {
            // Fetch order information for each game with rate limiting
            const resultsWithOrder = await Promise.all(
                results.map(async (game, index) => {
                    try {
                        // Add a small delay between requests to prevent API spam
                        if (index > 0) {
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }

                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 5000);
                        
                        const response = await fetch(`/api/proxy/games/${game.id}`, {
                            cache: "no-store",
                            signal: controller.signal
                        });
                        
                        clearTimeout(timeoutId);

                        if (response.ok) {
                            const details = await response.json();
                            const order = details.order || 0;
                            console.log(`Game ${game.id} (${game.name}): order = ${order}`);
                            return { ...game, order };
                        } else {
                            console.warn(`Failed to fetch order for game ${game.id}: ${response.status}`);
                            return { ...game, order: 0 };
                        }
                    } catch (error) {
                        console.warn(`Failed to fetch order for game ${game.id}:`, error);
                        return { ...game, order: 0 };
                    }
                })
            );

            console.log("Games with order data:", resultsWithOrder.map(g => ({ id: g.id, name: g.name, order: g.order })));

            // Sort by order (simple numeric sorting)
            const sorted = resultsWithOrder.sort((a, b) => {
                const orderA = a.order || 0;
                const orderB = b.order || 0;
                return orderA - orderB;
            });

            console.log("Sorted games:", sorted.map(g => ({ id: g.id, name: g.name, order: g.order })));
            setSortedResults(sorted);
        } catch (error) {
            console.error("Failed to sort by order:", error);
            setSortError("Failed to sort results by order. Showing unsorted results.");
            setSortedResults(results);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // Only sort when the component mounts or when key dependencies change
        if (sortByOrder && locationId && results.length > 0) {
            console.log("Triggering sort due to dependency change");
            sortResults();
        }
    }, [sortByOrder, locationId, results.length]); // Remove sortResults from dependencies to prevent infinite loops

    if (isLoading) {
        return (
            <div style={{ textAlign: "center", padding: "20px", opacity: 0.7 }}>
                Sorting results by order...
            </div>
        );
    }

    if (sortError) {
        return (
            <>
                <div style={{ 
                    background: "#3b0f12", 
                    border: "1px solid #5b1a1f", 
                    color: "#ffd7d7", 
                    padding: "8px 12px", 
                    borderRadius: 8, 
                    marginBottom: 12,
                    fontSize: 14
                }}>
                    {sortError}
                </div>
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
            </>
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
