import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/env";
import { capStream, fetchStream } from "@/lib/http";

export const dynamic = "force-dynamic";

const MAX_COVER_BYTES = 10 * 1024 * 1024; // the API refuses to store larger covers too
const COVER_TIMEOUT_MS = 10_000;

/**
 * Browser-safe public proxy for a library cover.
 *
 * The API answers with the file itself or a redirect (presigned S3 URL / IGDB URL) which
 * is followed here, server-side. Because that target can be an external host, the fetch
 * has a timeout, the body is streamed (not buffered) with a size cap, and only real
 * images are relayed -- never whatever an arbitrary URL happens to return.
 */
export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
    const { id } = await props.params;
    if (!/^\d+$/.test(id)) return new NextResponse(null, { status: 400 });

    let upstream: Response;
    try {
        upstream = await fetchStream(
            `${API_BASE_URL}/games/${encodeURIComponent(id)}/cover`,
            { cache: "no-store" },
            COVER_TIMEOUT_MS,
            request.signal
        );
    } catch {
        return new NextResponse(null, { status: 502 });
    }

    if (!upstream.ok || !upstream.body) {
        await upstream.body?.cancel().catch(() => {});
        return new NextResponse(null, { status: upstream.ok ? 502 : upstream.status });
    }

    const type = (upstream.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const length = Number(upstream.headers.get("content-length") ?? "");
    if (!type.startsWith("image/") || (Number.isFinite(length) && length > MAX_COVER_BYTES)) {
        await upstream.body.cancel().catch(() => {});
        return new NextResponse(null, { status: 502 });
    }

    const headers: Record<string, string> = {
        "content-type": upstream.headers.get("content-type") ?? type,
        "cache-control": upstream.headers.get("cache-control") ?? "public, max-age=3600",
        "x-content-type-options": "nosniff",
    };
    // fetch() transparently decompresses, so the upstream length is only valid for uncompressed bodies.
    if (Number.isFinite(length) && length > 0 && !upstream.headers.get("content-encoding")) headers["content-length"] = String(length);
    return new NextResponse(capStream(upstream.body, MAX_COVER_BYTES), { status: 200, headers });
}
