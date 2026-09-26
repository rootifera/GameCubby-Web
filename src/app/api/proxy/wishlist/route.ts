import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const upstream = await fetch(`${API_BASE_URL}/wishlist/`, { cache: "no-store", headers: { Accept: "application/json" } });
        return new NextResponse(await upstream.text(), {
            status: upstream.status,
            headers: { "content-type": upstream.headers.get("content-type") ?? "application/json", "cache-control": "no-store" },
        });
    } catch {
        return NextResponse.json({ detail: "Failed to reach API /wishlist/" }, { status: 502 });
    }
}
