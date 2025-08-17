// src/app/api/admin/games/[id]/files/sync-files/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

function readToken(): string {
    return cookies().get("__gcub_a")?.value || cookies().get("gc_at")?.value || "";
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
    const token = readToken();
    if (!token) {
        return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
        const upstream = await fetch(
            `${API_BASE_URL}/games/${encodeURIComponent(params.id)}/files/sync-files`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
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
        return NextResponse.json({ detail: "Failed to reach API per-game sync" }, { status: 502 });
    } finally {
        clearTimeout(timeout);
    }
}
