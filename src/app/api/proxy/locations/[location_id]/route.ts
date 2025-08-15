import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/env";

// GET /api/proxy/locations/:location_id -> GET {API_BASE_URL}/locations/:location_id
export async function GET(
    _req: NextRequest,
    { params }: { params: { location_id: string } }
) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 5000);

    try {
        const upstream = await fetch(
            `${API_BASE_URL}/locations/${encodeURIComponent(params.location_id)}`,
            {
                method: "GET",
                cache: "no-store",
                headers: { Accept: "application/json" },
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
        return NextResponse.json({ error: "upstream fetch failed" }, { status: 502 });
    } finally {
        clearTimeout(t);
    }
}
