// src/app/admin/settings/password/page.tsx
import React from "react";
import ChangePasswordForm from "./ChangePasswordForm";

export const metadata = {
    title: "Admin • Change Password",
    description: "Update your administrator password",
};

export default function AdminChangePasswordPage() {
    const panel: React.CSSProperties = {
        background: "#0f0f0f",
        border: "1px solid #262626",
        borderRadius: 12,
        padding: 14,
    };
    const title: React.CSSProperties = { fontSize: 18, fontWeight: 700, marginBottom: 10 };

    return (
        <div>
            <div style={title}>Change Password</div>
            <section style={panel}>
                <ChangePasswordForm />
            </section>
        </div>
    );
}
