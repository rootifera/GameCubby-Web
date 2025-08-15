import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/env";

function authForwardHeaders(req: NextRequest) {
    const h: Record<string, string> = { Accept: "application/json" };
    const cookie = req.headers.get("cookie");
    const auth = req.headers.get("authorization");
    if (cookie) h["Cookie"] = cookie;
    if (auth) h["Authorization"] = auth;
    return h;
}

// GET /api/proxy/games?…  ->  GET {API_BASE_URL}/games?…
export async function GET(req: NextRequest) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 10000);

    try {
        const incoming = new URL(req.url);
        const qs = incoming.search; // includes leading "?" if present
        const upstreamUrl = `${API_BASE_URL}/games${qs}`;

        const upstream = await fetch(upstreamUrl, {
            method: "GET",
            cache: "no-store",
            headers: authForwardHeaders(req),
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

// POST /api/proxy/games  ->  POST {API_BASE_URL}/games
export async function POST(req: NextRequest) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 15000);

    try {
        const upstreamUrl = `${API_BASE_URL}/games`;
        const json = await req.json().catch(() => ({}));

        const headers = authForwardHeaders(req);
        headers["Content-Type"] = "application/json";

        const upstream = await fetch(upstreamUrl, {
            method: "POST",
            cache: "no-store",
            headers,
            body: JSON.stringify(json),
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
