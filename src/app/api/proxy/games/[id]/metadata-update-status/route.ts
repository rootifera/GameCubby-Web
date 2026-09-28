import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/env";
import { readTokenFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Public metadata-status proxy. An admin token is forwarded only when available. */
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const { id } = await props.params;
    if (!/^\d+$/.test(id)) return NextResponse.json({ detail: "Invalid game id" }, { status: 400 });

    const token = readTokenFromRequest(req);
    try {
        const upstream = await fetch(`${API_BASE_URL}/games/${encodeURIComponent(id)}/metadata-update-status`, {
            cache: "no-store",
            headers: token ? { Accept: "application/json", Authorization: `Bearer ${token}` } : { Accept: "application/json" },
        });
        return new NextResponse(await upstream.text(), {
            status: upstream.status,
            headers: {
                "content-type": upstream.headers.get("content-type") ?? "application/json",
                "cache-control": "no-store",
            },
        });
    } catch {
        return NextResponse.json({ detail: "Failed to reach API metadata update status" }, { status: 502 });
    }
}
