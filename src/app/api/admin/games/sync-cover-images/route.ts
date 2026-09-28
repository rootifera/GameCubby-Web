import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

async function readToken(): Promise<string> {
    const cookieStore = await cookies();
    return cookieStore.get("__gcub_a")?.value || cookieStore.get("gc_at")?.value || "";
}

async function forward(method: "GET" | "POST") {
    const token = await readToken();
    if (!token) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), method === "POST" ? 30000 : 15000);
    try {
        const upstream = await fetch(`${API_BASE_URL}/games/sync-cover-images${method === "POST" ? "" : "/status"}`, {
            method,
            cache: "no-store",
            headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
            signal: controller.signal,
        });
        return new NextResponse(await upstream.text(), {
            status: upstream.status,
            headers: {
                "content-type": upstream.headers.get("content-type") ?? "application/json",
                "cache-control": "no-store",
            },
        });
    } catch {
        return NextResponse.json({ detail: "Failed to reach API cover-image sync" }, { status: 502 });
    } finally {
        clearTimeout(timeout);
    }
}

/** POST /api/admin/games/sync-cover-images -> POST /games/sync-cover-images */
export async function POST() {
    return forward("POST");
}

/** GET /api/admin/games/sync-cover-images -> GET /games/sync-cover-images/status */
export async function GET() {
    return forward("GET");
}
