import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 10000);

    try {
        const incoming = new URL(req.url);
        const qs = incoming.search; // includes leading "?" if present
        const upstreamUrl = `${API_BASE_URL}/search/advanced${qs}`;

        const upstream = await fetch(upstreamUrl, {
            method: "GET",
            cache: "no-store",
            headers: { Accept: "application/json" },
            signal: controller.signal,
        });

        const body = await upstream.text();
        return new NextResponse(body, {
            status: upstream.status,
            headers: {
                "content-type": upstream.headers.get("content-type") ?? "application/json",
                "cache-control": "no-store",
            },
        });
    } catch {
        return NextResponse.json({ error: "upstream fetch failed" }, { status: 502 });
    } finally {
        clearTimeout(t);
    }
}
