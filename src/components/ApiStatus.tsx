"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Status = "checking" | "online" | "offline";

export default function ApiStatus() {
    const [status, setStatus] = useState<Status>("checking");
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const color = useMemo(() => {
        switch (status) {
            case "online":
                return "#22c55e"; // green
            case "offline":
                return "#ef4444"; // red
            default:
                return "#a3a3a3"; // gray (checking)
        }
    }, [status]);

    const title = useMemo(() => {
        switch (status) {
            case "online":
                return "API: online";
            case "offline":
                return "API: offline";
            default:
                return "API: checking…";
        }
    }, [status]);

    async function ping() {
        // call our server-side proxy so the browser doesn't care about API host/ports
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 3000);
        try {
            const res = await fetch("/api/health", {
                cache: "no-store",
                signal: controller.signal
            });
            if (!res.ok) throw new Error("bad status");
            const data = (await res.json()) as { online?: boolean };
            setStatus(data?.online ? "online" : "offline");
        } catch {
            setStatus("offline");
        } finally {
            clearTimeout(t);
        }
    }

    useEffect(() => {
        // initial check
        ping();
        // re-check every 30s
        timerRef.current = setInterval(ping, 30000);
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div title={title} aria-label={title} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span
          aria-hidden
          style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: color,
              boxShadow: `0 0 0 2px rgba(255,255,255,0.04)`
          }}
      />
            <span style={{ fontSize: 12, opacity: 0.8 }}>API</span>
        </div>
    );
}
