import React from "react";
import LocationManager from "./LocationManager";

export const metadata = {
    title: "Admin • Location Manager",
    description: "View, add, rename and delete locations",
};

export default function AdminLocationManagerPage() {
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
            <div style={titleStyle}>Location Manager</div>
            <section style={panel}>
                {/* client manager */}
                <LocationManager />
            </section>
        </div>
    );
}
