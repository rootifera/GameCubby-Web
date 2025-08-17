// src/app/admin/settings/app/page.tsx
import React from "react";
import SettingsAppForm from "./SettingsAppForm";

export const metadata = {
    title: "Admin • Application Settings",
    description: "Manage GameCubby application settings",
};

export default function AdminAppSettingsPage() {
    const panel: React.CSSProperties = {
        background: "#0f0f0f",
        border: "1px solid #262626",
        borderRadius: 12,
        padding: 14,
    };
    const title: React.CSSProperties = { fontSize: 18, fontWeight: 700, marginBottom: 10 };

    return (
        <div>
            <div style={title}>Application Settings</div>
            <section style={panel}>
                <SettingsAppForm />
            </section>
        </div>
    );
}
