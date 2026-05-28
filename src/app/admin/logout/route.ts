// src/app/admin/logout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { shouldUseSecureCookies } from "@/lib/auth";

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

    // Clear legacy cookie
    res.cookies.set({
        name: LEGACY_COOKIE,
        value: "",
        httpOnly: true,
        sameSite: "strict",
        secure: shouldBeSecure,
        path: "/",
        maxAge: 0,
    });

    return res;
}
