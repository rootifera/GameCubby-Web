import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

// Public browser-safe proxy for the backend's cached library cover endpoint.
// The API base can be an internal Docker hostname, so clients must not load it directly.
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
    const { id } = await props.params;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
        const upstream = await fetch(`${API_BASE_URL}/games/${encodeURIComponent(id)}/cover`, {
            cache: "no-store",
            signal: controller.signal,
        });
        const body = await upstream.arrayBuffer();

        return new NextResponse(body, {
            status: upstream.status,
            headers: {
                "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
                "cache-control": upstream.headers.get("cache-control") ?? "public, max-age=3600",
            },
        });
    } catch {
        return new NextResponse(null, { status: 502 });
    } finally {
        clearTimeout(timeout);
    }
}
