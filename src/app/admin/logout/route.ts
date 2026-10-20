// src/app/admin/logout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { shouldUseSecureCookies } from "@/lib/auth";
import { SESSION_PROOF_COOKIE } from "@/lib/session";

const NEW_COOKIE = "__gcub_a";
const LEGACY_COOKIE = "gc_at";

export async function GET(req: NextRequest) {
    // Check if this is a real logout request or an automatic RSC call
    const isRscRequest = req.nextUrl.searchParams.has('_rsc');
    const userAgent = req.headers.get('user-agent') || '';
    
    // If this is an RSC request or doesn't look like a real logout, don't clear cookies
    if (isRscRequest || userAgent.includes('Next.js') || userAgent.includes('RSC')) {
        return new NextResponse('OK', { status: 200 });
    }

    // Logging out is a state change done with GET (it's a plain link in the nav). Without this, any
    // other website could log you out just by embedding the URL. Browsers label where a request
    // came from: only same-origin navigations (and typed/bookmarked URLs, "none") are honoured.
    const site = req.headers.get("sec-fetch-site");
    if (site === "cross-site" || site === "same-site") {
        return new NextResponse(null, { status: 303, headers: { Location: "/admin", "Cache-Control": "no-store" } });
    }

    // Determine if cookies should be secure based on PROXY setting
    const shouldBeSecure = shouldUseSecureCookies(req);

    const res = new NextResponse(null, {
        status: 303,
        headers: {
            Location: "/admin/login",
            "Cache-Control": "no-store",
        },
    });

    // Clear new cookie
    res.cookies.set({
        name: NEW_COOKIE,
        value: "",
        httpOnly: true,
        sameSite: "strict",
        secure: shouldBeSecure,
        path: "/",
        maxAge: 0,
    });

    // Clear legacy cookie and the session proof
    for (const name of [LEGACY_COOKIE, SESSION_PROOF_COOKIE]) {
        res.cookies.set({
            name,
            value: "",
            httpOnly: true,
            sameSite: "strict",
            secure: shouldBeSecure,
            path: "/",
            maxAge: 0,
        });
    }

    return res;
}
