// src/app/api/admin/igdb/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();

    if (!q) {
        return NextResponse.json([], { status: 200, headers: { "Cache-Control": "no-store" } });
    }

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);

    try {
        const upstream = await fetch(
            `${API_BASE_URL}/igdb/search?q=${encodeURIComponent(q)}`,
            {
                cache: "no-store",
                signal: controller.signal,
                // OpenAPI: this endpoint is public — do NOT send Authorization
                headers: {},
            }
        );

        const text = await upstream.text();
        return new NextResponse(text, {
            status: upstream.status,
            headers: {
                "content-type": upstream.headers.get("content-type") ?? "application/json",
                "cache-control": "no-store",
            },
        });
    } catch {
        return NextResponse.json({ error: "Failed to reach API /igdb/search" }, { status: 502 });
    } finally {
        clearTimeout(t);
    }
}
