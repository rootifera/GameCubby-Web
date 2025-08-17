// src/app/api/proxy/games/[id]/files/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
        const incoming = new URL(req.url);
        const qs = incoming.search; // includes leading "?" if present
        const id = encodeURIComponent(params.id);

        // Pass token if present (endpoint is public, but token enables locked-down servers)
        const token =
            cookies().get("__gcub_a")?.value ||
            cookies().get("gc_at")?.value ||
            "";

        const headers: Record<string, string> = { Accept: "application/json" };
        if (token) headers.Authorization = `Bearer ${token}`;

        const upstream = await fetch(`${API_BASE_URL}/games/${id}/files/${qs}`, {
            method: "GET",
            cache: "no-store",
            headers,
            signal: controller.signal,
        });

        const body = await upstream.text();

        return new NextResponse(body, {
            status: upstream.status,
            headers: {
                "content-type": upstream.headers.get("content-type") ?? "application/json",
                "cache-control": "no-store",
            },
        });
    } catch {
        return NextResponse.json({ detail: "upstream fetch failed" }, { status: 502 });
    } finally {
        clearTimeout(timeout);
    }
}
