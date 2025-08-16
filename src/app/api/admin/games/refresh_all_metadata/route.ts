// src/app/api/admin/games/refresh_all_metadata/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

function readToken(): string {
    return cookies().get("__gcub_a")?.value || cookies().get("gc_at")?.value || "";
}

function urlVariants() {
    return [
        `${API_BASE_URL}/games/refresh_all_metadata/`,
        `${API_BASE_URL}/games/refresh_all_metadata`,
    ];
}

async function passthrough(url: string, init: RequestInit, timeoutMs = 300000 /* up to 5 min */) {
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

/** POST /api/admin/games/refresh_all_metadata -> POST {API_BASE_URL}/games/refresh_all_metadata[/] */
export async function POST(_req: NextRequest) {
    const token = readToken();
    if (!token) {
        return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const headers: HeadersInit = {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
    };

    for (const url of urlVariants()) {
        const res = await passthrough(url, { method: "POST", headers });
        if (res.status !== 405 && res.status !== 404) return res;
    }

    return NextResponse.json(
        { detail: "refresh_all_metadata not allowed upstream (tried with and without trailing slash)" },
        { status: 405 }
    );
}

export function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: { Allow: "POST, OPTIONS", "cache-control": "no-store" },
    });
}
