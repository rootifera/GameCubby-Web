// src/app/admin/login/success/page.tsx
export default function LoginSuccessPage({
    searchParams,
}: {
    searchParams?: { next?: string };
}) {
    const next = searchParams?.next || "/admin";

    // Small HTML that pings /api/health immediately, then redirects.
    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8"/>
    <title>Login successful…</title>
    <meta http-equiv="refresh" content="0; url=${next}">
    <script>
      (function () {
        try {
          // Immediately call /api/health to update authentication state
          fetch('/api/health?t=' + Date.now(), { 
            cache: 'no-store', 
            credentials: 'same-origin',
            headers: { 'Cache-Control': 'no-cache' }
          })
          .finally(function () { window.location.replace('${next}'); });
        } catch (e) {
          window.location.replace('${next}');
        }
      })();
    </script>
  </head>
  <body style="background:#0f0f10;color:#eaeaea;font-family:system-ui,Arial,sans-serif;">
    <div style="max-width:640px;margin:20vh auto 0;padding:16px;text-align:center;">
      <h1 style="margin:0 0 8px 0;font-size:20px;">Login successful…</h1>
      <p style="opacity:.8">Redirecting to <a href="${next}" style="color:#a0c4ff;">${next}</a>...</p>
    </div>
  </body>
</html>`;

    return (
        <div dangerouslySetInnerHTML={{ __html: html }} />
    );
}
