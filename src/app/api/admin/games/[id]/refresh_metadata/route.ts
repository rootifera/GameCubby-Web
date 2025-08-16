// src/app/api/admin/games/[id]/refresh_metadata/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

function readToken(): string {
    return cookies().get("__gcub_a")?.value || cookies().get("gc_at")?.value || "";
}

function urlVariants(id: string) {
    const enc = encodeURIComponent(id);
    return [
        `${API_BASE_URL}/games/${enc}/refresh_metadata/`,
        `${API_BASE_URL}/games/${enc}/refresh_metadata`,
    ];
}

async function passthrough(url: string, init: RequestInit, timeoutMs = 15000) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const upstream = await fetch(url, { ...init, cache: "no-store", signal: controller.signal });
        const text = await upstream.text();
        return new NextResponse(text, {
            status: upstream.status,
            headers: {
                "content-type": upstream.headers.get("content-type") ?? "application/json",
                "cache-control": "no-store",
            },
        });
    } finally {
        clearTimeout(t);
    }
}

/** POST /api/admin/games/:id/refresh_metadata  ->  POST {API_BASE_URL}/games/:id/refresh_metadata[/] */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
    const token = readToken();
    if (!token) {
        return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const headers: HeadersInit = {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
    };

    // Try both shapes; return the first non-405/404
    for (const url of urlVariants(params.id)) {
        const res = await passthrough(url, { method: "POST", headers });
        if (res.status !== 405 && res.status !== 404) return res;
    }

    return NextResponse.json(
        { detail: "refresh_metadata not allowed upstream (tried with and without trailing slash)" },
        { status: 405 }
    );
}

export function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: { Allow: "POST, OPTIONS", "cache-control": "no-store" },
    });
}
