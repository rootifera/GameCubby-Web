import React from "react";
import BulkLocationMigrator from "./BulkLocationMigrator";

export const metadata = {
    title: "Admin • Bulk Change Location",
    description: "Move all games from one location to another",
};

export default function AdminBulkLocationMigratePage() {
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

    return (
        <div>
            <div style={titleStyle}>Bulk Change Location</div>
            <section style={panel}>
                <BulkLocationMigrator />
            </section>
        </div>
    );
}
