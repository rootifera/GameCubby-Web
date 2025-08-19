// src/app/api/proxy/games/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

import { readTokenFromRequest } from "@/lib/auth";

function readToken(req: NextRequest): string {
    return readTokenFromRequest(req);
}

function baseHeaders(token?: string) {
    const h: Record<string, string> = { Accept: "application/json" };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
}

// GET /api/proxy/games/:id  ->  GET {API_BASE_URL}/games/:id
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 10000);

    try {
        const token = readToken(req); // optional for public GET; include if present
        const upstream = await fetch(
            `${API_BASE_URL}/games/${encodeURIComponent(params.id)}`,
            {
                method: "GET",
                cache: "no-store",
                headers: baseHeaders(token),
                signal: controller.signal,
            }
        );

        const body = await upstream.text();
        return new NextResponse(body, {
            status: upstream.status,
            headers: {
                "content-type": upstream.headers.get("content-type") ?? "application/json",
                "cache-control": "no-store",
            },
        });
    } catch {
        return NextResponse.json({ detail: "upstream fetch failed" }, { status: 502 });
    } finally {
        clearTimeout(t);
    }
}

// PUT /api/proxy/games/:id  ->  PUT {API_BASE_URL}/games/:id
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    const token = readToken(req);
    if (!token) {
        return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    let body: string;
    try {
        body = await req.text(); // pass-through JSON exactly
    } catch {
        return NextResponse.json({ detail: "Invalid request body" }, { status: 400 });
    }

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 15000);

    try {
        const upstream = await fetch(
            `${API_BASE_URL}/games/${encodeURIComponent(params.id)}`,
            {
                method: "PUT",
                cache: "no-store",
                headers: {
                    ...baseHeaders(token),
                    "Content-Type": "application/json",
                },
                body,
                signal: controller.signal,
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
        return NextResponse.json({ detail: "upstream fetch failed" }, { status: 502 });
    } finally {
        clearTimeout(t);
    }
}

// DELETE /api/proxy/games/:id  ->  DELETE {API_BASE_URL}/games/:id
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    const token = readToken(req);
    if (!token) {
        return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 15000);

    try {
        const upstream = await fetch(
            `${API_BASE_URL}/games/${encodeURIComponent(params.id)}`,
            {
                method: "DELETE",
                cache: "no-store",
                headers: baseHeaders(token),
                signal: controller.signal,
            }
        );

        const body = await upstream.text();
        return new NextResponse(body, {
            status: upstream.status,
            headers: {
                "content-type": upstream.headers.get("content-type") ?? "application/json",
                "cache-control": "no-store",
            },
        });
    } catch {
        return NextResponse.json({ detail: "upstream fetch failed" }, { status: 502 });
    } finally {
        clearTimeout(t);
    }
}
