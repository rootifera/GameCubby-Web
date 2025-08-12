import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(
    _req: NextRequest,
    ctx: { params: { file_id: string } }
) {
    const fileId = (ctx.params.file_id || "").trim();
    if (!fileId) {
        return NextResponse.json({ error: "Missing file_id" }, { status: 400 });
    }

    const upstream = await fetch(`${API_BASE_URL}/downloads/${encodeURIComponent(fileId)}`, {
        cache: "no-store",
    });

    // Friendly message when public downloads are disabled upstream
    if (upstream.status === 403) {
        return NextResponse.json(
            { error: "Public downloads are disabled on this server." },
            { status: 403 }
        );
    }

    if (!upstream.ok || !upstream.body) {
        const msg = `Upstream error: ${upstream.status} ${upstream.statusText}`;
        return NextResponse.json({ error: msg }, { status: upstream.status || 500 });
    }

    // Stream the file down, preserving typical download headers
    const headers = new Headers();
    const ct = upstream.headers.get("content-type") || "application/octet-stream";
    const cd = upstream.headers.get("content-disposition") || "attachment";
    const cl = upstream.headers.get("content-length");

    headers.set("content-type", ct);
    headers.set("content-disposition", cd);
    if (cl) headers.set("content-length", cl);

    return new NextResponse(upstream.body, {
        status: 200,
        headers,
    });
}
