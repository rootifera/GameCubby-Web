import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/env";

export async function GET(
    _req: Request,
    { params }: { params: { parent_id: string } }
) {
    const { parent_id } = params;
    try {
        const upstream = await fetch(`${API_BASE_URL}/locations/children/${encodeURIComponent(parent_id)}`, {
            cache: "no-store"
        });
        const text = await upstream.text();
        return new NextResponse(text, {
            status: upstream.status,
            headers: { "content-type": upstream.headers.get("content-type") || "application/json" }
        });
    } catch {
        return NextResponse.json({ error: "Failed to reach API /locations/children" }, { status: 502 });
    }
}
