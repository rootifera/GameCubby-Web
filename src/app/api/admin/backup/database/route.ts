import { NextRequest, NextResponse } from "next/server";
import { readToken } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/env";
import { fetchStream } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const token = await readToken();
    if (!token) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

    let upstream: Response;
    try {
        // The API runs pg_dump to completion before it sends response headers, so the
        // header deadline has to cover the whole dump.
        upstream = await fetchStream(`${API_BASE_URL}/backup/`, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
        }, 15 * 60_000, req.signal);
    } catch {
        return NextResponse.json({ detail: "Failed to reach API /backup/" }, { status: 502 });
    }

    if (!upstream.ok || !upstream.body) {
        const text = await upstream.text().catch(() => "");
        return NextResponse.json(
            { detail: text || `Backup failed (${upstream.status})` },
            { status: upstream.status || 500 }
        );
    }

    const headers = new Headers();
    headers.set("content-type", upstream.headers.get("content-type") || "application/octet-stream");
    headers.set(
        "content-disposition",
        upstream.headers.get("content-disposition") || 'attachment; filename="backup.zip"'
    );
    const len = upstream.headers.get("content-length");
    if (len) headers.set("content-length", len);
    headers.set("cache-control", "no-store");

    return new NextResponse(upstream.body, { status: 200, headers });
}
