import React, { Suspense } from "react";
import { cookies } from "next/headers";
import Sidebar from "./Sidebar";
import styles from "./admin.module.css";
import { bootstrapOnce } from "../sentinel/bootstrapOnStart";

export const metadata = {
    title: "Admin • GameCubby",
    description: "Admin panel",
};

/* ---- minimal JWT decode just to read `exp` ---- */
type JwtPayload = { exp?: number };

async function readAuthToken(): Promise<string | null> {
    // Accept either cookie name (back-compat)
    const cookieStore = await cookies();
    return cookieStore.get("__gcub_a")?.value || cookieStore.get("gc_at")?.value || null;
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

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    // Server-side, no hydration race: validate the JWT, not just its presence
    const token = await readAuthToken();
    const isAuthed = token ? isTokenValidNow(token) : false;

    const panelStyle: React.CSSProperties = {
        background: "var(--gc-surface)",
        border: "1px solid var(--gc-border)",
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
            className="gc-admin-layout"
            style={{
                display: "grid",
                gridTemplateColumns: "260px 1fr",
                gap: 16,
                alignItems: "start",
            }}
        >
            <Suspense fallback={null}><MaintenanceBootstrap /></Suspense>
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

// Maintenance setup must not delay access to the administration tools.
async function MaintenanceBootstrap() {
    await bootstrapOnce();
    return null;
}
