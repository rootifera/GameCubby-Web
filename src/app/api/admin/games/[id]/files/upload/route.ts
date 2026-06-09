// src/app/api/admin/games/[id]/files/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UPLOAD_TIMEOUT_MS = 2 * 60 * 60 * 1000;

async function readToken(): Promise<string> {
    const cookieStore = await cookies();
    return cookieStore.get("__gcub_a")?.value || cookieStore.get("gc_at")?.value || "";
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const token = await readToken();
    if (!token) {
        return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") ?? "application/octet-stream";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

    try {
        const upstream = await fetch(
            `${API_BASE_URL}/games/${encodeURIComponent(params.id)}/files/upload`,
            {
                method: "POST",
                headers: {
                    "Content-Type": contentType,
                    Authorization: `Bearer ${token}`,
                },
                // Stream the multipart body through to the API
                body: req.body,
                cache: "no-store",
                signal: controller.signal,
                // @ts-expect-error — node-fetch duplex hint
                duplex: "half",
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
        return NextResponse.json({ detail: "Failed to reach API file upload" }, { status: 502 });
    } finally {
        clearTimeout(timeout);
    }
}
