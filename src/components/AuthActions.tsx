"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";

export default function AuthActions() {
    const [authed, setAuthed] = useState<boolean | null>(null);
    const [checking, setChecking] = useState(false);

    const check = useCallback(async () => {
        // If already checking, don't start another check
        if (checking) {
            return;
        }

        setChecking(true);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            
            const res = await fetch("/api/health", { 
                cache: "no-store",
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (res.ok) {
                const data = (await res.json()) as { authed?: boolean };
                setAuthed(Boolean(data?.authed));
            } else {
                // Keep last known state on error to avoid flicker
                console.warn("Health check failed:", res.status);
            }
        } catch (error) {
            // Keep last-known state to avoid flicker
            console.warn("Health check error:", error);
        } finally {
            setChecking(false);
        }
    }, [checking]);

    useEffect(() => {
        // Initial check
        check();

        // Set up periodic checks with reasonable interval
        const intervalId = setInterval(check, 30000); // Check every 30 seconds

        return () => {
            clearInterval(intervalId);
        };
    }, [check]);

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
