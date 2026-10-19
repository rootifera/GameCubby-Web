// src/app/api/admin/igdb/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/env";
import { readToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    // Admin-only: IGDB lookups spend shared API quota. The API enforces the token too.
    const token = await readToken();
    if (!token) {
        return NextResponse.json({ detail: "Not authenticated" }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }

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
                headers: { Authorization: `Bearer ${token}` },
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
