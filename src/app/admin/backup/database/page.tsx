import React from "react";

export const metadata = {
    title: "Admin • Backup Database",
    description: "Create and download a database backup",
};

export default function AdminBackupPage() {
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

    const note: React.CSSProperties = { fontSize: 12, opacity: 0.8, marginTop: 8 };

    return (
        <div>
            <div style={titleStyle}>Backup Database</div>
            <div style={panel}>
                <p style={{ marginTop: 0 }}>
                    Generates a database backup on the server and streams it to your browser.
                </p>
                <a href="/api/admin/backup/database" style={btn}>
                    Create & Download Backup
                </a>
                <div style={note}>
                    Requires admin authentication. The filename and format are determined by the server.
                </div>
            </div>
        </div>
    );
}
