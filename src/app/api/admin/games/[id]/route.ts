// src/app/api/admin/games/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

function readToken(): string {
    // Same cookie names as your working Add flow
    return cookies().get("__gcub_a")?.value || cookies().get("gc_at")?.value || "";
}

function urlVariants(id: string) {
    const enc = encodeURIComponent(id);
    // Try trailing slash first (common in DRF), then without.
    return [`${API_BASE_URL}/games/${enc}/`, `${API_BASE_URL}/games/${enc}`];
}

async function passthrough(url: string, init: RequestInit, timeoutMs = 15000) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const upstream = await fetch(url, { ...init, cache: "no-store", signal: controller.signal });
        const text = await upstream.text(); // may be empty on 204
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

/* ---------------- PUT (existing behavior) ---------------- */
// PUT /api/admin/games/:id  — forwards to  PUT {API_BASE_URL}/games/:id[/]  with Bearer from cookie
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    const token = readToken();
    if (!token) {
        return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    let body: string;
    try {
        body = await req.text();
    } catch {
        return NextResponse.json({ detail: "Invalid request body" }, { status: 400 });
    }

    const headers: HeadersInit = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
    };

    // Prefer /:id/ but fall back to /:id if the backend 404/405s
    for (const url of urlVariants(params.id)) {
        const res = await passthrough(url, { method: "PUT", headers, body });
        if (res.status !== 405 && res.status !== 404) return res;
    }

    return NextResponse.json(
        { detail: "PUT not allowed upstream for /games/:id (tried with and without trailing slash)" },
        { status: 405 }
    );
}

/* ---------------- NEW: DELETE ---------------- */
// DELETE /api/admin/games/:id  — forwards to  DELETE {API_BASE_URL}/games/:id[/]  with Bearer
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
    const token = readToken();
    if (!token) {
        return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const headers: HeadersInit = {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
    };

    // Try both URL shapes; return first non-405 response
    for (const url of urlVariants(params.id)) {
        const res = await passthrough(url, { method: "DELETE", headers });
        if (res.status !== 405) return res;
    }

    return NextResponse.json(
        { detail: "DELETE not allowed upstream for /games/:id (tried with and without trailing slash)" },
        { status: 405 }
    );
}

/* ---------------- Optional: OPTIONS to avoid 405 on preflight ---------------- */
export function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: { Allow: "PUT, DELETE, OPTIONS", "cache-control": "no-store" },
    });
}
