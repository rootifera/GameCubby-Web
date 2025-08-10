import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/env";

export async function GET(
    _req: Request,
    { params }: { params: { tag_id: string } }
) {
    const { tag_id } = params;

    if (!/^\d+$/.test(tag_id)) {
        return NextResponse.json({ error: "Invalid tag id" }, { status: 400 });
    }

    try {
        const upstream = await fetch(`${API_BASE_URL}/tags/${tag_id}`, { cache: "no-store" });
        const text = await upstream.text();
        return new NextResponse(text, {
            status: upstream.status,
            headers: {
                "content-type": upstream.headers.get("content-type") || "application/json",
                "cache-control": "no-store"
            }
        });
    } catch {
        return NextResponse.json({ error: "Failed to reach API /tags/{id}" }, { status: 502 });
    }
}
