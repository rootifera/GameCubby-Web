import { NextRequest, NextResponse } from "next/server";
import { readToken } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const { id } = await props.params;
    const token = await readToken();
    if (!token) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    if (!/^\d+$/.test(id)) return NextResponse.json({ detail: "Invalid wishlist id" }, { status: 400 });

    let body: string;
    try { body = await req.text(); } catch { return NextResponse.json({ detail: "Invalid request body" }, { status: 400 }); }

    try {
        const upstream = await fetch(`${API_BASE_URL}/wishlist/${encodeURIComponent(id)}/resolve`, {
            method: "POST",
            cache: "no-store",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body,
        });
        return new NextResponse(await upstream.text(), {
            status: upstream.status,
            headers: { "content-type": upstream.headers.get("content-type") ?? "application/json", "cache-control": "no-store" },
        });
    } catch {
        return NextResponse.json({ detail: "Failed to reach API wishlist resolve endpoint" }, { status: 502 });
    }
}
