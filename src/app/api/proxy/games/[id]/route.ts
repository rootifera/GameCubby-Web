import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/env";

export async function GET(
    _req: NextRequest,
    ctx: { params: { id: string } }
) {
    const id = ctx.params.id;
    if (!id) {
        return NextResponse.json({ error: "missing id" }, { status: 400 });
    }

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 5000);

    try {
        const upstream = await fetch(`${API_BASE_URL}/games/${encodeURIComponent(id)}`, {
            cache: "no-store",
            signal: controller.signal
        });

        const text = await upstream.text();

        return new NextResponse(text, {
            status: upstream.status,
            headers: {
                "content-type": upstream.headers.get("content-type") ?? "application/json",
                "cache-control": "no-store"
            }
        });
    } catch {
        return NextResponse.json({ error: "upstream fetch failed" }, { status: 502 });
    } finally {
        clearTimeout(t);
    }
}
