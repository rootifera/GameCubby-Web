import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

function readToken() {
    return cookies().get("__gcub_a")?.value || cookies().get("gc_at")?.value || "";
}

export async function GET(_req: NextRequest) {
    const token = readToken();
    if (!token) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

    let upstream: Response;
    try {
        upstream = await fetch(`${API_BASE_URL}/export/games/csv`, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
        });
    } catch {
        return NextResponse.json({ detail: "Failed to reach API export/csv" }, { status: 502 });
    }

    if (!upstream.ok || !upstream.body) {
        const text = await upstream.text().catch(() => "");
        return NextResponse.json({ detail: text || `Export failed (${upstream.status})` }, { status: upstream.status || 500 });
    }

    const headers = new Headers();
    headers.set("content-type", upstream.headers.get("content-type") || "text/csv; charset=utf-8");
    headers.set("content-disposition", upstream.headers.get("content-disposition") || 'attachment; filename="games.csv"');
    const len = upstream.headers.get("content-length");
    if (len) headers.set("content-length", len);
    headers.set("cache-control", "no-store");

    return new NextResponse(upstream.body, { status: 200, headers });
}
