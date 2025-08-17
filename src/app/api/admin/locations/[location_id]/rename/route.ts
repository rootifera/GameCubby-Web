// src/app/api/admin/locations/[location_id]/rename/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

function readToken(): string {
    return cookies().get("__gcub_a")?.value || cookies().get("gc_at")?.value || "";
}

/** PUT /api/admin/locations/:location_id/rename -> PUT {API_BASE_URL}/locations/:id/rename (bearer) */
export async function PUT(req: NextRequest, { params }: { params: { location_id: string } }) {
    const token = readToken();
    if (!token) {
        return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    // Pass through JSON body as-is
    let body: string;
    try {
        body = await req.text();
    } catch {
        return NextResponse.json({ detail: "Invalid request body" }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
        const upstream = await fetch(
            `${API_BASE_URL}/locations/${encodeURIComponent(params.location_id)}/rename`,
            {
                method: "PUT",
                cache: "no-store",
                signal: controller.signal,
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body,
            }
        );

        const text = await upstream.text();
        return new NextResponse(text, {
            status: upstream.status,
            headers: {
                "content-type": upstream.headers.get("content-type") ?? "application/json",
                "cache-control": "no-store",
            },
        });
    } catch {
        return NextResponse.json(
            { detail: "Failed to reach API /locations/:id/rename" },
            { status: 502 }
        );
    } finally {
        clearTimeout(timeout);
    }
}
