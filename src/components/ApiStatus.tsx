"use client";

import { useEffect, useMemo, useState } from "react";
import { healthService, type HealthStatus } from "@/lib/healthService";

type Status = "checking" | "online" | "offline";

export default function ApiStatus() {
    const [status, setStatus] = useState<Status>("checking");

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

    useEffect(() => {
        // Subscribe to health status updates
        const unsubscribe = healthService.subscribe((healthStatus: HealthStatus) => {
            setStatus(healthStatus.online ? "online" : "offline");
        });

        // Cleanup subscription
        return unsubscribe;
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
