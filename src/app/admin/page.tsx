// src/app/admin/page.tsx
import React from "react";
import { API_BASE_URL } from "@/lib/env";
import { readFile } from "node:fs/promises";
import path from "node:path";

/** Shape returned by the API root */
type ApiRoot = {
    app_name: string;
    version: string;
    build_name: string;
    build_time: number; // unix seconds
};

/** Shape of local web version file */
type WebVersion = {
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
        headers: { Accept: "application/json" },
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`API root request failed (${res.status} ${res.statusText}): ${text}`);
    }
    return (await res.json()) as ApiRoot;
}

/** Load src/web-version.json from the repo on the server side. */
async function fetchWebVersion(): Promise<WebVersion | null> {
    try {
        const filePath = path.join(process.cwd(), "src", "web-version.json");
        const raw = await readFile(filePath, "utf8");
        const data = JSON.parse(raw) as Partial<WebVersion>;
        // minimal validation
        if (
            typeof data?.app_name === "string" &&
            typeof data?.version === "string" &&
            typeof data?.build_name === "string" &&
            typeof data?.build_time === "number"
        ) {
            return {
                app_name: data.app_name,
                version: data.version,
                build_name: data.build_name,
                build_time: data.build_time,
            };
        }
        return null;
    } catch {
        return null;
    }
}

/** Fetch latest version info from GitHub for comparison */
async function fetchGitHubVersions(): Promise<{
    api: WebVersion | null;
    web: WebVersion | null;
}> {
    try {
        const [apiRes, webRes] = await Promise.allSettled([
            fetch("https://raw.githubusercontent.com/rootifera/GameCubby/refs/heads/main/gamecubby_api/version.json", {
                cache: "no-store",
            }),
            fetch("https://raw.githubusercontent.com/rootifera/GameCubby-Web/refs/heads/main/src/web-version.json", {
                cache: "no-store",
            }),
        ]);

        const api = apiRes.status === "fulfilled" && apiRes.value.ok 
            ? await apiRes.value.json() 
            : null;
        const web = webRes.status === "fulfilled" && webRes.value.ok 
            ? await webRes.value.json() 
            : null;

        return { api, web };
    } catch {
        return { api: null, web: null };
    }
}

/** Get update status for a component */
function getUpdateStatus(localBuildTime: number, remoteBuildTime: number | null): {
    status: "latest" | "update-available" | "unable-to-check";
    label: string;
    color: string;
} {
    if (!remoteBuildTime) {
        return {
            status: "unable-to-check",
            label: "Unable to check",
            color: "#dc2626", // nice red
        };
    }

    if (remoteBuildTime > localBuildTime) {
        return {
            status: "update-available",
            label: "New Version Available",
            color: "#059669", // nice green
        };
    }

    return {
        status: "latest",
        label: "Latest Version",
        color: "#6b7280", // nice grey
    };
}

function fmtUnixSeconds(sec: number) {
    if (!Number.isFinite(sec)) return "—";
    // Convert seconds → ms
    const d = new Date(sec * 1000);
    // e.g., 2025-08-14 19:42:09 (local time)
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
        d.getMinutes()
    )}:${pad(d.getSeconds())}`;
}

export const metadata = {
    title: "Admin • Overview",
    description: "GameCubby admin overview",
};

export default async function AdminOverviewPage() {
    let data: ApiRoot | null = null;
    let apiError: string | null = null;
    let web: WebVersion | null = null;
    let githubVersions: { api: WebVersion | null; web: WebVersion | null } = { api: null, web: null };

    try {
        [data, web, githubVersions] = await Promise.allSettled([
            fetchApiRoot(), 
            fetchWebVersion(),
            fetchGitHubVersions()
        ]).then((r) => {
            const api = r[0].status === "fulfilled" ? r[0].value : null;
            const webv = r[1].status === "fulfilled" ? r[1].value : null;
            const github = r[2].status === "fulfilled" ? r[2].value : { api: null, web: null };
            if (r[0].status === "rejected") {
                apiError = (r[0].reason as Error)?.message ?? "Unknown error";
            }
            return [api, webv, github] as const;
        });
    } catch (e: any) {
        apiError = e?.message ?? "Unknown error";
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

            {/* Web build card (from src/web-version.json) */}
            <div style={{ ...panel, marginBottom: 12, position: "relative" }}>
                {/* Update Status Badge - Top Right */}
                {web && (
                    <div style={{
                        position: "absolute",
                        top: 14,
                        right: 14,
                        zIndex: 10,
                    }}>
                        {(() => {
                            const status = getUpdateStatus(web.build_time, githubVersions.web?.build_time || null);
                            return (
                                <span style={{
                                    background: status.color,
                                    color: "#ffffff",
                                    padding: "4px 8px",
                                    borderRadius: 6,
                                    fontSize: 12,
                                    fontWeight: 500,
                                    display: "inline-block",
                                    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.2)",
                                }}>
                                    {status.label}
                                </span>
                            );
                        })()}
                    </div>
                )}

                {web ? (
                    <div style={grid}>
                        <div style={keyStyle}>Web App</div>
                        <div style={valStyle}>{web.app_name}</div>

                        <div style={keyStyle}>Version</div>
                        <div style={valStyle}>{web.version}</div>

                        <div style={keyStyle}>Build Name</div>
                        <div style={valStyle}>{web.build_name}</div>

                        <div style={keyStyle}>Build Time</div>
                        <div style={valStyle}>{fmtUnixSeconds(web.build_time)}</div>

                        <div style={keyStyle}>Raw Timestamp</div>
                        <div style={valStyle}>{web.build_time}</div>
                    </div>
                ) : (
                    <div style={{ opacity: 0.75 }}>No local web build info found (src/web-version.json).</div>
                )}
            </div>

            {/* API build card */}
            <div style={{ ...panel, position: "relative" }}>
                {/* Update Status Badge - Top Right */}
                {data && (
                    <div style={{
                        position: "absolute",
                        top: 14,
                        right: 14,
                        zIndex: 10,
                    }}>
                        {(() => {
                            const status = getUpdateStatus(data.build_time, githubVersions.api?.build_time || null);
                            return (
                                <span style={{
                                    background: status.color,
                                    color: "#ffffff",
                                    padding: "4px 8px",
                                    borderRadius: 6,
                                    fontSize: 12,
                                    fontWeight: 500,
                                    display: "inline-block",
                                    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.2)",
                                }}>
                                    {status.label}
                                </span>
                            );
                        })()}
                    </div>
                )}

                {apiError ? (
                    <div style={{ color: "#ff6666" }}>Failed to load API root: {apiError}</div>
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
