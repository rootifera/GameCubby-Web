// src/app/admin/export/games/page.tsx
import React from "react";
import { ExportButtons } from "./ExportButtons";

export const metadata = {
    title: "Admin • Export Game Data",
    description: "Download your game data as JSON, CSV, or XLSX.",
};

export default function ExportGamesPage() {
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

    const btn: React.CSSProperties = {
        display: "inline-block",
        background: "#1e293b",
        color: "#fff",
        border: "1px solid #3b82f6",
        borderRadius: 8,
        padding: "10px 14px",
        fontWeight: 600,
        textDecoration: "none",
        whiteSpace: "nowrap",
    };

    return (
        <div>
            <div style={titleStyle}>Export Game Data</div>

            <div style={{ ...panel }}>
                <ExportButtons btnStyle={btn} />

                <div style={{ opacity: 0.7, marginTop: 12, fontSize: 12 }}>
                    Tip: Please backup your database regularly. Exporting data (especially json) can take a while!
                </div>
            </div>
        </div>
    );
}
