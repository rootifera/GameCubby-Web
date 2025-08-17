// src/app/admin/export/games/page.tsx
import React from "react";

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

    const card: React.CSSProperties = {
        background: "#111",
        border: "1px solid #262626",
        borderRadius: 12,
        padding: 14,
        display: "grid",
        gap: 8,
    };

    return (
        <div>
            <div style={titleStyle}>Export Game Data</div>

            <div style={{ ...panel }}>
                <div style={{ display: "grid", gap: 12 }}>
                    <div style={card}>
                        <div style={{ fontWeight: 700 }}>JSON export</div>
                        <div style={{ opacity: 0.75, fontSize: 13 }}>
                            Full game dataset as JSON.
                        </div>
                        <a href="/api/admin/export/games/json" download="games.json" style={btn}>
                            Download JSON
                        </a>
                    </div>

                    <div style={card}>
                        <div style={{ fontWeight: 700 }}>CSV export</div>
                        <div style={{ opacity: 0.75, fontSize: 13 }}>
                            Flat table of games in CSV format.
                        </div>
                        <a href="/api/admin/export/games/csv" download="games.csv" style={btn}>
                            Download CSV
                        </a>
                    </div>

                    <div style={card}>
                        <div style={{ fontWeight: 700 }}>XLSX export</div>
                        <div style={{ opacity: 0.75, fontSize: 13 }}>
                            Spreadsheet-friendly export (Excel).
                        </div>
                        <a href="/api/admin/export/games/excel" download="games.xlsx" style={btn}>
                            Download XLSX
                        </a>
                    </div>
                </div>

                <div style={{ opacity: 0.7, marginTop: 12, fontSize: 12 }}>
                    Tip: Please backup your database regularly.
                </div>
            </div>
        </div>
    );
}
