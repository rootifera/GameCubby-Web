import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/env";

// Proxies GET /api/proxy/search/basic?name=... -> GET {API_BASE_URL}/search/basic?name=...
export async function GET(req: NextRequest) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 5000);

    try {
        const incoming = new URL(req.url);
        const qs = incoming.search; // includes "?" if present
        const upstreamUrl = `${API_BASE_URL}/search/basic${qs}`;

        const upstream = await fetch(upstreamUrl, {
            method: "GET",
            cache: "no-store",
            headers: { Accept: "application/json" },
            signal: controller.signal,
        });

        const bodyText = await upstream.text();

        return new NextResponse(bodyText, {
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
