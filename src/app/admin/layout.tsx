import React from "react";
import { cookies } from "next/headers";
import Sidebar from "./Sidebar";
import styles from "./admin.module.css";

export const metadata = {
    title: "Admin • GameCubby",
    description: "Admin panel",
};

/* ---- minimal JWT decode just to read `exp` ---- */
type JwtPayload = { exp?: number };

function readAuthToken(): string | null {
    // Accept either cookie name (back-compat)
    return (
        cookies().get("__gcub_a")?.value ||
        cookies().get("gc_at")?.value ||
        null
    );
}

function decodeJwtPayload(token: string): JwtPayload | null {
    try {
        const parts = token.split(".");
        if (parts.length < 2) return null;
        const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const padded = base64 + "===".slice((base64.length + 3) % 4);
        const json = Buffer.from(padded, "base64").toString("utf8");
        return JSON.parse(json) as JwtPayload;
    } catch {
        return null;
    }
}

function isTokenValidNow(token: string): boolean {
    const payload = decodeJwtPayload(token);
    if (!payload || typeof payload.exp !== "number") return false;
    const now = Math.floor(Date.now() / 1000);
    // Consider valid only if not expired
    return payload.exp > now;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    // Server-side, no hydration race: validate the JWT, not just its presence
    const token = readAuthToken();
    const isAuthed = token ? isTokenValidNow(token) : false;

    const panelStyle: React.CSSProperties = {
        background: "#111",
        border: "1px solid #262626",
        borderRadius: 12,
        padding: 14,
    };

    // If not authed: only render the content (e.g., login page). No sidebar.
    if (!isAuthed) {
        return (
            <section style={{ ...panelStyle, minHeight: 400 }}>
                {children}
            </section>
        );
    }

    // Authed: show sidebar + content
    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "260px 1fr",
                gap: 16,
                alignItems: "start",
            }}
        >
            {/* Sidebar (client) */}
            <aside style={{ ...panelStyle, position: "sticky", top: 16, alignSelf: "start" }}>
                <Sidebar />
            </aside>

            {/* Admin content */}
            <section className={styles.contentPanel} style={{ ...panelStyle, minHeight: 400 }}>
                {children}
            </section>
        </div>
    );
}
