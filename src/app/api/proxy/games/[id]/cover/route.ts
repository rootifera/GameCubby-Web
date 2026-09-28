import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Browser-safe public proxy for a cached library cover. */
export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
    const { id } = await props.params;
    if (!/^\d+$/.test(id)) return new NextResponse(null, { status: 400 });
    try {
        const upstream = await fetch(`${API_BASE_URL}/games/${encodeURIComponent(id)}/cover`, { cache: "no-store" });
        return new NextResponse(await upstream.arrayBuffer(), {
            status: upstream.status,
            headers: {
                "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
                "cache-control": upstream.headers.get("cache-control") ?? "public, max-age=3600",
            },
        });
    } catch { return new NextResponse(null, { status: 502 }); }
}
