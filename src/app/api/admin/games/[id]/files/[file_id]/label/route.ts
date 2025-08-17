// src/app/api/admin/games/[id]/files/[file_id]/label/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

function readToken(): string {
    return cookies().get("__gcub_a")?.value || cookies().get("gc_at")?.value || "";
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string; file_id: string } }) {
    const token = readToken();
    if (!token) {
        return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

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
            `${API_BASE_URL}/games/${encodeURIComponent(params.id)}/files/${encodeURIComponent(params.file_id)}/label`,
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body,
                cache: "no-store",
                signal: controller.signal,
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
        return NextResponse.json({ detail: "Failed to reach API label update" }, { status: 502 });
    } finally {
        clearTimeout(timeout);
    }
}
