// src/app/api/admin/files/sync-all/route.ts
import { NextRequest, NextResponse } from "next/server";
import { readToken } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

// POST /api/admin/files/sync-all  ->  POST {API_BASE_URL}/files/sync-all  (Bearer)
export async function POST(_req: NextRequest) {
    const token = readToken();
    if (!token) {
        return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
        const upstream = await fetch(`${API_BASE_URL}/files/sync-all`, {
            method: "POST",
            cache: "no-store",
            signal: controller.signal,
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${token}`,
            },
        });

        const body = await upstream.text();

        return new NextResponse(body, {
            status: upstream.status,
            headers: {
                "content-type": upstream.headers.get("content-type") ?? "application/json",
                "cache-control": "no-store",
            },
        });
    } catch {
        return NextResponse.json({ detail: "Failed to reach API /files/sync-all" }, { status: 502 });
    } finally {
        clearTimeout(timeout);
    }
}
