// src/app/admin/page.tsx
import React from "react";
import { API_BASE_URL } from "@/lib/env";

/** Shape returned by the API root */
type ApiRoot = {
    app_name: string;
    version: string;
    build_name: string;
    build_time: number; // unix seconds
};

async function fetchApiRoot(): Promise<ApiRoot> {
    const url = `${API_BASE_URL}/`;
    const res = await fetch(url, {
        method: "GET",
        // Always show the latest build info
        cache: "no-store",
        headers: { "Accept": "application/json" },
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`API root request failed (${res.status} ${res.statusText}): ${text}`);
    }
    return (await res.json()) as ApiRoot;
}

function fmtUnixSeconds(sec: number) {
    if (!Number.isFinite(sec)) return "—";
    // Convert seconds → ms
    const d = new Date(sec * 1000);
    // e.g., 2025-08-14 19:42:09 (local time)
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export const metadata = {
    title: "Admin • Overview",
    description: "GameCubby admin overview",
};

export default async function AdminOverviewPage() {
    let data: ApiRoot | null = null;
    let error: string | null = null;

    try {
        data = await fetchApiRoot();
    } catch (e: any) {
        error = e?.message ?? "Unknown error";
    }

    const panel: React.CSSProperties = {
        background: "#0f0f0f",
        border: "1px solid #262626",
        borderRadius: 12,
        padding: 14,
    };

    const titleStyle: React.CSSProperties = {
        fontSize: 18,
        fontWeight: 700,
        marginBottom: 10,
    };

    const grid: React.CSSProperties = {
        display: "grid",
        gridTemplateColumns: "180px 1fr",
        gap: 8,
    };

    const keyStyle: React.CSSProperties = {
        opacity: 0.8,
    };

    const valStyle: React.CSSProperties = {
        fontWeight: 600,
        color: "#eaeaea",
    };

    return (
        <div>
            <div style={titleStyle}>Overview</div>

            <div style={panel}>
                {error ? (
                    <div style={{ color: "#ff6666" }}>
                        Failed to load API root: {error}
                    </div>
                ) : data ? (
                    <div style={grid}>
                        <div style={keyStyle}>Application</div>
                        <div style={valStyle}>{data.app_name}</div>

                        <div style={keyStyle}>Version</div>
                        <div style={valStyle}>{data.version}</div>

                        <div style={keyStyle}>Build Name</div>
                        <div style={valStyle}>{data.build_name}</div>

                        <div style={keyStyle}>Build Time</div>
                        <div style={valStyle}>{fmtUnixSeconds(data.build_time)}</div>

                        <div style={keyStyle}>Raw Timestamp</div>
                        <div style={valStyle}>{data.build_time}</div>
                    </div>
                ) : (
                    <div style={{ opacity: 0.75 }}>No data.</div>
                )}
            </div>
        </div>
    );
}
