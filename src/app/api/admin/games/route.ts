// src/app/api/admin/games/route.ts
import { NextRequest, NextResponse } from "next/server";
import { readToken } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

// GET /games/ — PUBLIC per OpenAPI
export async function GET() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
        const upstream = await fetch(`${API_BASE_URL}/games/`, {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
            // Public endpoint: no Authorization header
            headers: {},
        });

        const text = await upstream.text();
        return new NextResponse(text, {
            status: upstream.status,
            headers: {
                "content-type": upstream.headers.get("content-type") ?? "application/json",
                "cache-control": "no-store",
            },
        });
    } catch {
        return NextResponse.json({ detail: "Failed to reach API /games/" }, { status: 502 });
    } finally {
        clearTimeout(timeout);
    }
}

// POST /games/ — REQUIRES bearer per OpenAPI
export async function POST(req: NextRequest) {
    const token = readToken();

    if (!token) {
        return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    // Read JSON body safely
    let payload: unknown;
    try {
        payload = await req.json();
    } catch {
        return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
    }

    // Forward to API
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
        const upstream = await fetch(`${API_BASE_URL}/games/`, {
            method: "POST",
            signal: controller.signal,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        });

        const text = await upstream.text();
        return new NextResponse(text, {
            status: upstream.status,
            headers: {
                "content-type": upstream.headers.get("content-type") ?? "application/json",
                "cache-control": "no-store",
            },
        });
    } catch {
        return NextResponse.json({ detail: "Failed to reach API /games/" }, { status: 502 });
    } finally {
        clearTimeout(timeout);
    }
}
