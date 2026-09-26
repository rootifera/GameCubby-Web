import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
    const { id } = await props.params;
    if (!/^\d+$/.test(id)) return NextResponse.json({ detail: "Invalid wishlist id" }, { status: 400 });
    try {
        const upstream = await fetch(`${API_BASE_URL}/wishlist/${encodeURIComponent(id)}`, { cache: "no-store", headers: { Accept: "application/json" } });
        return new NextResponse(await upstream.text(), {
            status: upstream.status,
            headers: { "content-type": upstream.headers.get("content-type") ?? "application/json", "cache-control": "no-store" },
        });
    } catch {
        return NextResponse.json({ detail: "Failed to reach API wishlist item" }, { status: 502 });
    }
}
