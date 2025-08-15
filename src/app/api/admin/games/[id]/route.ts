// src/app/api/admin/games/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

function readToken(): string {
    // Same cookie names as your working Add flow
    return cookies().get("__gcub_a")?.value || cookies().get("gc_at")?.value || "";
}

// PUT /api/admin/games/:id  — forwards to  PUT {API_BASE_URL}/games/:id  with Bearer from cookie
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    const token = readToken();
    if (!token) {
        return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    // Read body as-is and forward (expects JSON upstream)
    let body: string;
    try {
        body = await req.text();
    } catch {
        return NextResponse.json({ detail: "Invalid request body" }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
        const upstream = await fetch(`${API_BASE_URL}/games/${encodeURIComponent(params.id)}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body,
            cache: "no-store",
            signal: controller.signal,
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
        return NextResponse.json({ detail: "Failed to reach API /games/:id" }, { status: 502 });
    } finally {
        clearTimeout(timeout);
    }
}
