// src/app/api/admin/files/sync-all/route.ts
import { NextRequest, NextResponse } from "next/server";
import { readToken } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

async function proxySyncAll(method: "GET" | "POST", path = "/files/sync-all") {
    const token = await readToken();
    if (!token) {
        return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
        const upstream = await fetch(`${API_BASE_URL}${path}`, {
            method,
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
        return NextResponse.json({ detail: `Failed to reach API ${path}` }, { status: 502 });
    } finally {
        clearTimeout(timeout);
    }
}

// POST /api/admin/files/sync-all  ->  POST {API_BASE_URL}/files/sync-all  (Bearer)
export async function POST(_req: NextRequest) {
    void _req;
    return proxySyncAll("POST");
}

// GET /api/admin/files/sync-all -> GET {API_BASE_URL}/files/sync-all/status
export async function GET(_req: NextRequest) {
    void _req;
    return proxySyncAll("GET", "/files/sync-all/status");
}
