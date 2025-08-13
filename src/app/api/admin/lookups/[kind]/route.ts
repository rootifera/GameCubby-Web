import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

const MAP: Record<string, string> = {
    platforms: "/platforms/",
    modes: "/modes/",
    genres: "/genres/",
    perspectives: "/perspectives/",
    companies: "/company/",
    collections: "/collections/",
    tags: "/tags/",
};

export async function GET(req: NextRequest, { params }: { params: { kind: string } }) {
    const kind = params.kind?.toLowerCase();
    const upstreamPath = MAP[kind];
    if (!upstreamPath) {
        return NextResponse.json({ detail: "Unknown lookup kind" }, { status: 404 });
    }

    // Require admin cookie so these lookups are only available in admin UI.
    const gcAt = cookies().get("gc_at")?.value;
    if (!gcAt) {
        return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
        const url = `${API_BASE_URL}${upstreamPath}`;
        const res = await fetch(url, {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
            headers: {
                // Most of these endpoints don’t require auth, but include it so we’re consistent.
                Authorization: `Bearer ${gcAt}`,
            },
        });

        const text = await res.text();
        return new NextResponse(text, {
            status: res.status,
            headers: {
                "content-type": res.headers.get("content-type") ?? "application/json",
                "cache-control": "no-store",
            },
        });
    } catch {
        return NextResponse.json({ detail: "Failed to reach upstream" }, { status: 502 });
    } finally {
        clearTimeout(timeout);
    }
}
