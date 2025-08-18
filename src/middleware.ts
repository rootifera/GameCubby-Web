// src/middleware.ts
import type {NextRequest} from "next/server";
import {NextResponse} from "next/server";

const COOKIE_NAME = "__gcub_a";

function allowWhileMaintenance(pathname: string) {

    if (
        pathname.startsWith("/admin/login") ||
        pathname.startsWith("/admin/logout") ||
        pathname === "/admin/sentinel/restore" ||
        pathname.startsWith("/admin/sentinel/restore")
    ) {
        return true;
    }
    if (
        pathname.startsWith("/_next") ||
        pathname.startsWith("/favicon") ||
        pathname.startsWith("/robots.txt") ||
        pathname.startsWith("/sitemap.xml")
    ) {
        return true;
    }
    if (pathname.startsWith("/api/sentinel/")) return true;

    return false;
}

async function getMaintenanceEnabled(req: NextRequest): Promise<boolean> {
    try {
        const url = new URL("/api/sentinel/maintenance/status", req.url);
        const res = await fetch(url, {
            headers: {"x-gc-skip-mw": "1"},
            cache: "no-store",
        });
        if (!res.ok) return false;
        const j = await res.json();
        return !!j?.enabled;
    } catch {
        return false;
    }
}

export default async function middleware(req: NextRequest) {
    const {pathname, search} = req.nextUrl;

    if (
        pathname.startsWith("/admin") &&
        !pathname.startsWith("/admin/login") &&
        !pathname.startsWith("/admin/logout")
    ) {
        const token = req.cookies.get(COOKIE_NAME)?.value ?? "";
        if (!token) {
            const loginUrl = new URL("/admin/login", req.url);
            const nextPath = `${pathname}${search || ""}`;
            loginUrl.searchParams.set("next", nextPath || "/admin");
            return NextResponse.redirect(loginUrl);
        }
    }


    if (allowWhileMaintenance(pathname)) {
        return NextResponse.next();
    }

    const maintOn = await getMaintenanceEnabled(req);
    if (maintOn) {
        const target = new URL("/admin/sentinel/restore", req.url);
        return NextResponse.redirect(target);
    }

    return NextResponse.next();
}
export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",

    ],
};
