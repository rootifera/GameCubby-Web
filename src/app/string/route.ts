import { NextRequest } from "next/server";

/**
 * Probe endpoint to catch unexpected GET /string requests
 * and log where they come from (referer) + UA.
 */
export function GET(req: NextRequest) {
    const referer = req.headers.get("referer") || "";
    const ua = req.headers.get("user-agent") || "";
    console.log("[/string probe] hit", {
        url: req.nextUrl.pathname + req.nextUrl.search,
        referer,
        ua,
    });
    return new Response(null, { status: 204 }); // no content
}
