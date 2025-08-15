import React from "react";
import { API_BASE_URL } from "@/lib/env";
import SearchAndDeleteGame from "./SearchAndDeleteGame";

export const metadata = {
    title: "Admin • Game Management • Delete",
    description: "Find a game and delete it",
};

type Named = { id: number; name: string };

async function fetchPlatforms(): Promise<Named[]> {
    const res = await fetch(`${API_BASE_URL}/platforms/`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const arr = (await res.json()) as Named[];
    return Array.isArray(arr) ? arr : [];
}

export default async function AdminGameDeletePage() {
    const titleStyle: React.CSSProperties = { fontSize: 18, fontWeight: 700, marginBottom: 10 };
    const panel: React.CSSProperties = {
        background: "#0f0f0f",
        border: "1px solid #262626",
        borderRadius: 12,
        padding: 14,
    };

    // Server-side load keeps client clean
    const platforms = await fetchPlatforms();

    return (
        <div>
            <div style={titleStyle}>Delete Game</div>
            <div style={panel}>
                <SearchAndDeleteGame initialPlatforms={platforms} />
            </div>
        </div>
    );
}
