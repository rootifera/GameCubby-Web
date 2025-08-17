// src/app/api/admin/locations/[location_id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

function readToken(): string {
    return cookies().get("__gcub_a")?.value || cookies().get("gc_at")?.value || "";
}

/** GET /api/admin/locations/:location_id  ->  GET {API_BASE_URL}/locations/:id (public) */
export async function GET(_req: NextRequest, { params }: { params: { location_id: string } }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
        const upstream = await fetch(`${API_BASE_URL}/locations/${encodeURIComponent(params.location_id)}`, {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
            headers: { Accept: "application/json" },
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
        return NextResponse.json({ detail: "Failed to reach API /locations/:id" }, { status: 502 });
    } finally {
        clearTimeout(timeout);
    }
}

/** DELETE /api/admin/locations/:location_id  ->  DELETE {API_BASE_URL}/locations/:id (bearer) */
export async function DELETE(_req: NextRequest, { params }: { params: { location_id: string } }) {
    const token = readToken();
    if (!token) {
        return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
        const upstream = await fetch(`${API_BASE_URL}/locations/${encodeURIComponent(params.location_id)}`, {
            method: "DELETE",
            cache: "no-store",
            signal: controller.signal,
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${token}`,
            },
        });

        // 204 No Content is expected on success
        const text = await upstream.text();
        return new NextResponse(text || null, {
            status: upstream.status,
            headers: {
                "content-type": upstream.headers.get("content-type") ?? "application/json",
                "cache-control": "no-store",
            },
        });
    } catch {
        return NextResponse.json({ detail: "Failed to reach API /locations/:id (DELETE)" }, { status: 502 });
    } finally {
        clearTimeout(timeout);
    }
}
