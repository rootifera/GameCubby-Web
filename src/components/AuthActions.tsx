"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { healthService, type HealthStatus } from "@/lib/healthService";

export default function AuthActions() {
    const [authed, setAuthed] = useState<boolean | null>(null);

    useEffect(() => {
        // Subscribe to health status updates
        const unsubscribe = healthService.subscribe((healthStatus: HealthStatus) => {
            setAuthed(healthStatus.authed);
        });

        // Cleanup subscription
        return unsubscribe;
    }, []);

    return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {authed ? (
                <>
                    <Link href="/admin" style={btnPrimary}>Admin Panel</Link>
                    <Link href="/admin/logout" style={btnGhost}>Logout</Link>
                </>
            ) : (
                <Link href="/admin/login" style={btnPrimary}>Login</Link>
            )}
            {/* no "refreshing" text; background checks happen silently */}
        </div>
    );
}

const btnPrimary: React.CSSProperties = {
    background: "#1e293b",
    color: "#fff",
    border: "1px solid #3b82f6",
    borderRadius: 8,
    padding: "8px 12px",
    fontWeight: 600,
    textDecoration: "none",
};

const btnGhost: React.CSSProperties = {
    background: "#151515",
    color: "#eaeaea",
    border: "1px solid #2b2b2b",
    borderRadius: 8,
    padding: "8px 12px",
    textDecoration: "none",
};
