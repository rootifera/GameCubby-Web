import { NextRequest, NextResponse } from "next/server";
import { readToken } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/env";
import { fetchStream, safeRedirectTarget } from "@/lib/http";

export const dynamic = "force-dynamic";

function errorHtml(title: string, message: string) {
    return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"/><title>${title}</title><meta name="robots" content="noindex"/></head>
<body style="margin:0;font-family:system-ui,Arial,sans-serif;background:#0b0b0b;color:#eaeaea;min-height:100vh;display:grid;place-items:center">
  <div style="max-width:680px;padding:16px">
    <div style="background:#111;border:1px solid #262626;border-radius:12px;padding:16px">
      <h1 style="margin:0 0 10px 0;font-size:20px">${title}</h1>
      <p style="opacity:.9;line-height:1.6">${message}</p>
    </div>
  </div>
</body>
</html>`;
}

// Waiting for the API to start answering (it may have to look the file up / presign it).
// Once headers arrive the transfer itself can take as long as it needs.
const DOWNLOAD_HEADERS_TIMEOUT_MS = 30_000;

export async function GET(
    req: NextRequest,
    ctx: { params: Promise<{ file_id: string }> }
) {
    const fileId = ((await ctx.params).file_id || "").trim();
    
    // Validate file ID format to prevent path traversal
    if (!fileId || !/^[a-zA-Z0-9\-_\.]+$/.test(fileId)) {
        return new NextResponse(
            errorHtml("Invalid file ID", "The provided file ID contains invalid characters."),
            {
                status: 400,
                headers: {
                    "Content-Type": "text/html; charset=utf-8",
                    "Cache-Control": "no-store",
                },
            }
        );
    }

    // Pass admin token if present so admins can always download even if public is disabled
    const token = await readToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    // Let download managers / browsers resume and seek large files.
    for (const name of ["range", "if-range"]) {
        const value = req.headers.get(name);
        if (value) headers[name] = value;
    }

    let upstream: Response;
    try {
        // req.signal: stop pulling the file from the API as soon as the visitor disconnects.
        upstream = await fetchStream(`${API_BASE_URL}/downloads/${encodeURIComponent(fileId)}`, {
            cache: "no-store",
            headers,
            redirect: "manual",
        }, DOWNLOAD_HEADERS_TIMEOUT_MS, req.signal);
    } catch {
        return new NextResponse(
            errorHtml("Download failed", "We couldn't reach the download server. Please try again."),
            {
                status: 502,
                headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
            }
        );
    }

    if (upstream.status >= 300 && upstream.status < 400) {
        const target = safeRedirectTarget(upstream.headers.get("location") ?? "", API_BASE_URL);
        if (target) {
            return NextResponse.redirect(target, upstream.status);
        }
        return new NextResponse(
            errorHtml("Unable to download", "The download server returned an invalid redirect."),
            { status: 502, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
        );
    }

    // 403: public downloads disabled / unauthorized
    if (upstream.status === 403) {
        let detail = "Public downloads are disabled by the administrator on this server.";
        try {
            const data = await upstream.clone().json();
            if (typeof (data as any)?.detail === "string") detail = (data as any).detail;
        } catch { /* ignore */ }
        return new NextResponse(
            errorHtml("Downloads disabled", detail),
            {
                status: 403,
                headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
            }
        );
    }

    // 404: file missing
    if (upstream.status === 404) {
        let detail = "The requested file could not be found. It may have been moved or deleted.";
        try {
            const data = await upstream.clone().json();
            if (typeof (data as any)?.detail === "string") detail = (data as any).detail;
        } catch { /* ignore */ }
        return new NextResponse(
            errorHtml("File not found", detail),
            {
                status: 404,
                headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
            }
        );
    }

    // 416: the requested byte range doesn't fit the file -- pass it through as-is.
    if (upstream.status === 416) {
        const h = new Headers();
        const range = upstream.headers.get("content-range");
        if (range) h.set("content-range", range);
        h.set("Cache-Control", "no-store");
        return new NextResponse(null, { status: 416, headers: h });
    }

    // Other non-OK errors: bubble up real status
    if (!upstream.ok || !upstream.body) {
        return new NextResponse(
            errorHtml(
                "Unable to download",
                `Upstream responded with ${upstream.status} ${upstream.statusText}.`
            ),
            {
                status: upstream.status || 500,
                headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
            }
        );
    }

    // Success: stream the file with proper headers
    const headersOut = new Headers();
    const ct = upstream.headers.get("content-type") || "application/octet-stream";
    const cd = upstream.headers.get("content-disposition") || "attachment";
    const cl = upstream.headers.get("content-length");

    headersOut.set("content-type", ct);
    headersOut.set("content-disposition", cd);
    if (cl && !upstream.headers.get("content-encoding")) headersOut.set("content-length", cl);
    // Range support: pass the partial-content headers through so resumes/seeks work.
    for (const name of ["content-range", "accept-ranges", "etag", "last-modified"]) {
        const value = upstream.headers.get(name);
        if (value) headersOut.set(name, value);
    }
    headersOut.set("Cache-Control", "no-store");

    return new NextResponse(upstream.body, {
        status: upstream.status === 206 ? 206 : 200,
        headers: headersOut,
    });
}
