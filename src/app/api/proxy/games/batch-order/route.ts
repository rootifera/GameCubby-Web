import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const { gameIds } = await req.json();
        
        if (!Array.isArray(gameIds) || gameIds.length === 0) {
            return NextResponse.json({ error: "Invalid gameIds array" }, { status: 400 });
        }

        // Limit the number of games to prevent abuse
        if (gameIds.length > 100) {
            return NextResponse.json({ error: "Too many games requested" }, { status: 400 });
        }

        // Fetch order information for all games in parallel
        const orderPromises = gameIds.map(async (gameId: number) => {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                
                const response = await fetch(`${API_BASE_URL}/games/${gameId}`, {
                    cache: "no-store",
                    headers: { Accept: "application/json" },
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    return { id: gameId, order: 0, error: `HTTP ${response.status}` };
                }

                const gameData = await response.json();
                return { id: gameId, order: gameData.order || 0 };
            } catch (error) {
                return { id: gameId, order: 0, error: "Request failed" };
            }
        });

        const results = await Promise.allSettled(orderPromises);
        
        // Process results and handle any failures gracefully
        const orderData = results.map((result, index) => {
            if (result.status === 'fulfilled') {
                return result.value;
            } else {
                return { id: gameIds[index], order: 0, error: "Promise rejected" };
            }
        });

        return NextResponse.json({ orders: orderData });
    } catch (error) {
        console.error("Batch order fetch error:", error);
        return NextResponse.json({ error: "Failed to fetch batch orders" }, { status: 500 });
    }
}
