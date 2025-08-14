import React from "react";
import { cookies } from "next/headers";
import Sidebar from "./Sidebar";
import styles from "./admin.module.css";

export const metadata = {
    title: "Admin • GameCubby",
    description: "Admin panel",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    // Server-side auth check
    const isAuthed = Boolean(cookies().get("__gcub_a")?.value);

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
