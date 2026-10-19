// src/app/api/admin/games/[id]/delete-impact/route.ts
import { NextRequest, NextResponse } from "next/server";
import { readToken } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/env";
import { fetchWithTimeout } from "@/lib/http";

export const dynamic = "force-dynamic";

/** What "also delete files" would remove for this game, and which other copies share them. */
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const { id } = await props.params;
    if (!/^\d+$/.test(id)) return NextResponse.json({ detail: "Invalid game id" }, { status: 400 });
    const token = await readToken();
    if (!token) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

    try {
        const upstream = await fetchWithTimeout(
            `${API_BASE_URL}/games/${id}/delete-impact`,
            { cache: "no-store", headers: { Accept: "application/json", Authorization: `Bearer ${token}` } },
            15_000,
            req.signal
        );
        return new NextResponse(await upstream.text(), {
            status: upstream.status,
            headers: { "content-type": upstream.headers.get("content-type") ?? "application/json", "cache-control": "no-store" },
        });
    } catch {
        return NextResponse.json({ detail: "Failed to reach API" }, { status: 502 });
    }
}
