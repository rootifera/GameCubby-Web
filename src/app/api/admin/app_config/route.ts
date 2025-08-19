// src/app/api/admin/app_config/route.ts
import { NextRequest, NextResponse } from "next/server";
import { readToken } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

// GET /api/admin/app_config  -> GET {API_BASE_URL}/app_config/
export async function GET() {
    const token = readToken();
    if (!token) {
        return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    try {
        const upstream = await fetch(`${API_BASE_URL}/app_config/`, {
            method: "GET",
            cache: "no-store",
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${token}`,
            },
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
        return NextResponse.json({ detail: "Failed to reach API /app_config/" }, { status: 502 });
    }
}

// POST /api/admin/app_config  -> POST {API_BASE_URL}/app_config/  (AppConfigEntry: { key, value })
export async function POST(req: NextRequest) {
    const token = readToken();
    if (!token) {
        return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    let body: string;
    try {
        body = await req.text(); // pass-through JSON
    } catch {
        return NextResponse.json({ detail: "Invalid request body" }, { status: 400 });
    }

    try {
        const upstream = await fetch(`${API_BASE_URL}/app_config/`, {
            method: "POST",
            cache: "no-store",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body,
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
        return NextResponse.json({ detail: "Failed to reach API /app_config/" }, { status: 502 });
    }
}
