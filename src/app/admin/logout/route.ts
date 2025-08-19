// src/app/admin/logout/route.ts
import { NextResponse } from "next/server";

const NEW_COOKIE = "__gcub_a";
const LEGACY_COOKIE = "gc_at";

export async function GET() {
    const isProd = process.env.NODE_ENV === "production";

    // Small HTML that pings /api/health immediately, then redirects.
    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8"/>
    <title>Logging out…</title>
    <meta http-equiv="refresh" content="0; url=/admin/login">
    <script>
      (function () {
        try {
          fetch('/api/health', { cache: 'no-store', credentials: 'same-origin' })
            .finally(function () { window.location.replace('/admin/login'); });
        } catch (e) {
          window.location.replace('/admin/login');
        }
      })();
    </script>
  </head>
  <body style="background:#0f0f10;color:#eaeaea;font-family:system-ui,Arial,sans-serif;">
    <div style="max-width:640px;margin:20vh auto 0;padding:16px;text-align:center;">
      <h1 style="margin:0 0 8px 0;font-size:20px;">Logging out…</h1>
      <p style="opacity:.8">If you are not redirected, <a href="/admin/login" style="color:#a0c4ff;">click here</a>.</p>
    </div>
  </body>
</html>`;

    // Build response and clear both cookies
    const res = new NextResponse(html, {
        status: 200,
        headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
        },
    });

    // Clear new cookie
    res.cookies.set({
        name: NEW_COOKIE,
        value: "",
        httpOnly: true,
        sameSite: "strict",
        secure: true,
        path: "/",
        maxAge: 0,
    });

    // Clear legacy cookie
    res.cookies.set({
        name: LEGACY_COOKIE,
        value: "",
        httpOnly: true,
        sameSite: "strict",
        secure: true,
        path: "/",
        maxAge: 0,
    });

    return res;
}
