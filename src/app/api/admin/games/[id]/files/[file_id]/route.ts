import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

function readToken(): string {
    return cookies().get("__gcub_a")?.value || cookies().get("gc_at")?.value || "";
}

export async function DELETE(
    _req: NextRequest,
    { params }: { params: { id: string; file_id: string } }
) {
    const token = readToken();
    if (!token) {
        return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
        const upstream = await fetch(
            `${API_BASE_URL}/games/${encodeURIComponent(params.id)}/files/${encodeURIComponent(params.file_id)}`,
            {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
                cache: "no-store",
                signal: controller.signal,
            }
        );

        // Backend returns 204 No Content on success — relay it verbatim.
        if (upstream.status === 204) {
            return new NextResponse(null, {
                status: 204,
                headers: { "cache-control": "no-store" },
            });
        }

        // Otherwise pass through body + status from upstream
        const text = await upstream.text();
        return new NextResponse(text, {
            status: upstream.status,
            headers: {
                "content-type": upstream.headers.get("content-type") ?? "application/json",
                "cache-control": "no-store",
            },
        });
    } catch {
        return NextResponse.json({ detail: "Failed to reach API file delete" }, { status: 502 });
    } finally {
        clearTimeout(timeout);
    }
}
