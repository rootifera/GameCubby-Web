import React from "react";
import { API_BASE_URL } from "@/lib/env";
import SearchAndPickGame from "./SearchAndPickGame";

export const metadata = {
    title: "Admin • Game Management • Update",
    description: "Find a game to update",
};

type Named = { id: number; name: string };

async function fetchPlatforms(): Promise<Named[]> {
    const res = await fetch(`${API_BASE_URL}/platforms/`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
    });
    if (!res.ok) {
        // keep UI usable even if platform list fails
        return [];
    }
    const arr = (await res.json()) as Named[];
    return Array.isArray(arr) ? arr : [];
}

export default async function AdminGameUpdatePage() {
    const titleStyle: React.CSSProperties = {
        fontSize: 18,
        fontWeight: 700,
        marginBottom: 10,
    };

    const panel: React.CSSProperties = {
        background: "#0f0f0f",
        border: "1px solid #262626",
        borderRadius: 12,
        padding: 14,
    };

    // Server-side load (no client env issues)
    const platforms = await fetchPlatforms();

    return (
        <div>
            <div style={titleStyle}>Update Game</div>
            <div style={panel}>
                {/* pass platforms to the client component */}
                <SearchAndPickGame initialPlatforms={platforms} />
            </div>
        </div>
    );
}
