// src/middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const ADMIN_COOKIE = "__gcub_a";
const MAINT_COOKIE = "__gc_maint";

// Paths always allowed while in maintenance (prefix match)
const DEFAULT_ALLOW: string[] = [
    "/admin/login",
    "/admin/logout",
    "/admin/sentinel/restore",
    "/api/sentinel/",        // sentinel APIs stay reachable
    "/api/health",           // health ping
    "/_next/",               // next assets
    "/favicon.ico",
    "/robots.txt",
    "/sitemap.xml",
];

function isAllowed(pathname: string, extra: string[] = []): boolean {
    const allow = [...DEFAULT_ALLOW, ...extra];
    return allow.some((p) => pathname.startsWith(p));
}

function maintenanceHtml(reason?: string | null) {
    const msg = reason ? `Maintenance in progress: ${escapeHtml(reason)}` : "We’re performing maintenance.";
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Maintenance • GameCubby</title>
<style>
  body{margin:0;background:#0f0f0f;color:#eaeaea;
       font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, 'Helvetica Neue', Arial, 'Noto Sans', 'Apple Color Emoji', 'Segoe UI Emoji';}
  .wrap{max-width:720px;margin:12vh auto;padding:24px}
  .card{background:#111;border:1px solid #262626;border-radius:12px;padding:20px;}
  h1{margin:0 0 8px 0;font-size:22px}
  p{opacity:.9;line-height:1.5}
  code{background:#1a1a1a;border:1px solid #2b2b2b;border-radius:6px;padding:2px 6px}
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>Maintenance Mode</h1>
      <p>${msg}</p>
      <p>Please try again in a few minutes.</p>
      <p style="opacity:.8;font-size:12px">If you’re an admin, open <code>/admin/sentinel/restore</code> to monitor or finish the operation.</p>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default async function middleware(req: NextRequest) {
    const { pathname, search } = req.nextUrl;

    // --- Skip static assets quickly (handled by matcher too) ---
    if (
        pathname.startsWith("/_next/") ||
        pathname === "/favicon.ico" ||
        pathname === "/robots.txt" ||
        pathname === "/sitemap.xml"
    ) {
        return NextResponse.next();
    }

    // --- Maintenance check (cookie OR internal API) ---
    // Avoid infinite loop: allow sentinel maintenance status without fetching
    const maintenanceStatusPath = "/api/sentinel/maintenance/status";
    if (pathname === maintenanceStatusPath) {
        return NextResponse.next();
    }

    let maintEnabled = false;
    let maintAllowExtra: string[] = [];
    let maintReason: string | undefined;

    // (1) Cookie toggle (set by enter/exit routes) — instant UI reaction
    const maintCookie = req.cookies.get(MAINT_COOKIE)?.value;
    if (maintCookie === "1") {
        maintEnabled = true;
    }

    // (2) Fallback to server-side status file via API (source of truth)
    if (!maintEnabled) {
        try {
            const u = new URL(req.url);
            u.pathname = maintenanceStatusPath;
            u.search = "";
            const r = await fetch(u.toString(), { cache: "no-store" });
            if (r.ok) {
                const j = await r.json();
                maintEnabled = !!j?.enabled;
                if (Array.isArray(j?.allow)) maintAllowExtra = j.allow.filter((v: any) => typeof v === "string");
                if (typeof j?.reason === "string") maintReason = j.reason;
            }
        } catch {
            // If status probe fails, fail open (no maintenance gate)
        }
    }

    if (maintEnabled) {
        // Allow only whitelisted prefixes while in maintenance
        if (!isAllowed(pathname, maintAllowExtra)) {
            // Block: return a friendly 503 for pages, JSON for API
            if (pathname.startsWith("/api/")) {
                return new NextResponse(JSON.stringify({ ok: false, maintenance: true }), {
                    status: 503,
                    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
                });
            }

            // Admin pages (except the restore console) → redirect to restore
            if (pathname.startsWith("/admin") && pathname !== "/admin/sentinel/restore") {
                const restoreUrl = new URL(req.url);
                restoreUrl.pathname = "/admin/sentinel/restore";
                restoreUrl.search = "";
                return NextResponse.redirect(restoreUrl, 302);
            }

            // Public pages -> friendly maintenance page
            return new NextResponse(maintenanceHtml(maintReason || undefined), {
                status: 503,
                headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
            });
        }
    }

    // --- Admin auth gate (outside of maintenance allowlist) ---
    // Only guard /admin/**, but allow the login & logout routes through
    if (
        pathname.startsWith("/admin") &&
        !pathname.startsWith("/admin/login") &&
        !pathname.startsWith("/admin/logout")
    ) {
        const token = req.cookies.get(ADMIN_COOKIE)?.value ?? "";
        if (!token) {
            const loginUrl = new URL("/admin/login", req.url);
            const nextPath = `${pathname}${search || ""}`;
            loginUrl.searchParams.set("next", nextPath || "/admin");
            return NextResponse.redirect(loginUrl);
        }
    }

    return NextResponse.next();
}

export const config = {
    // Run on everything except Next internals & common public files
    matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
