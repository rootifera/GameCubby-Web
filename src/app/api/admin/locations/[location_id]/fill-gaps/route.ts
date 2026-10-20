// src/app/api/admin/locations/[location_id]/fill-gaps/route.ts
import { NextRequest, NextResponse } from "next/server";
import { readToken } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/env";
import { fetchWithTimeout } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Renumber the games of a location so their order runs 1..N (preview first, then apply).
 * Body: { include_children: boolean, apply: boolean, fingerprint?: string }
 */
export async function POST(req: NextRequest, props: { params: Promise<{ location_id: string }> }) {
    const { location_id } = await props.params;
    if (!/^\d+$/.test(location_id)) return NextResponse.json({ detail: "Invalid location id" }, { status: 400 });
    const token = await readToken();
    if (!token) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

    let body: string;
    try {
        body = await req.text();
    } catch {
        return NextResponse.json({ detail: "Invalid request body" }, { status: 400 });
    }

    try {
        const upstream = await fetchWithTimeout(
            `${API_BASE_URL}/locations/${location_id}/fill-order-gaps`,
            {
                method: "POST",
                cache: "no-store",
                headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
                body,
            },
            60_000,
            req.signal
        );
        return new NextResponse(await upstream.text(), {
            status: upstream.status,
            headers: { "content-type": upstream.headers.get("content-type") ?? "application/json", "cache-control": "no-store" },
        });
    } catch {
        return NextResponse.json({ detail: "Failed to reach the API" }, { status: 502 });
    }
}
