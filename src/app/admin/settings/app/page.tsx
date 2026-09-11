import PageIntro from "@/components/PageIntro";
// src/app/admin/settings/app/page.tsx
import React from "react";
import SettingsAppForm from "./SettingsAppForm";

export const metadata = {
    title: "Admin • Application Settings",
    description: "Manage GameCubby application settings",
};

export default function AdminAppSettingsPage() {
    return (
        <div>
            <PageIntro eyebrow="Preferences" title="Application Settings" description="Manage your integrations, search preferences, and storage in one place." />
            <SettingsAppForm />
        </div>
    );
}
