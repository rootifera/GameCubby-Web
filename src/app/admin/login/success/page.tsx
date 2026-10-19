import { safeNextPath } from "@/lib/auth";
import Redirect from "./Redirect";

export default async function LoginSuccessPage(
  props: {
      searchParams?: Promise<{ next?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  // Never trust `next`: only same-site paths are allowed (blocks XSS and open redirects).
  const next = safeNextPath(searchParams?.next);

  return (
      <div style={{ background: "#0f0f10", color: "var(--gc-text)", fontFamily: "system-ui,Arial,sans-serif" }}>
          <div style={{ maxWidth: 640, margin: "20vh auto 0", padding: 16, textAlign: "center" }}>
              <h1 style={{ margin: "0 0 8px 0", fontSize: 20 }}>Login successful…</h1>
              <p style={{ opacity: 0.8 }}>
                  Redirecting to <a href={next} style={{ color: "#a0c4ff" }}>{next}</a>...
              </p>
          </div>
          <Redirect to={next} />
          <noscript>
              <meta httpEquiv="refresh" content={`0; url=${next}`} />
          </noscript>
      </div>
  );
}
