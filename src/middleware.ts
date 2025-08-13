// src/middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const COOKIE_NAME = "__gcub_a";

export default function middleware(req: NextRequest) {
    const { pathname, search } = req.nextUrl;

    // Only guard /admin/**, but allow the login & logout routes through
    if (!pathname.startsWith("/admin") ||
        pathname.startsWith("/admin/login") ||
        pathname.startsWith("/admin/logout")) {
        return NextResponse.next();
    }

    const token = req.cookies.get(COOKIE_NAME)?.value ?? "";

    if (!token) {
        const loginUrl = new URL("/admin/login", req.url);
        const nextPath = `${pathname}${search || ""}`;
        loginUrl.searchParams.set("next", nextPath || "/admin");
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/admin/:path*"],
};
