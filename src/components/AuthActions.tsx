"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function AuthActions() {
    const [authed, setAuthed] = useState<boolean | null>(null);
    const [checking, setChecking] = useState(false);
    const [initialized, setInitialized] = useState(false); // Track if we've completed first check
    const pathname = usePathname();

    async function check() {
        if (checking) return;
        
        setChecking(true);
        try {
            // Add cache busting parameter to ensure fresh data
            const timestamp = Date.now();
            const res = await fetch(`/api/health?t=${timestamp}`, { cache: "no-store" });
            const data = (await res.json()) as { authed?: boolean };
            setAuthed(Boolean(data?.authed));
            setInitialized(true); // Mark as initialized after first check
        } catch {
            // keep last-known state to avoid flicker
        } finally {
            setChecking(false);
        }
    }

    useEffect(() => {
        // Check immediately when component mounts
        void check();
        
        // Check immediately when pathname changes (page navigation)
        void check();
        
        // Also check every 5 seconds as backup
        const id = setInterval(check, 5000);
        return () => clearInterval(id);
    }, [pathname]); // Re-run when pathname changes

    // Don't show anything until we've completed the first authentication check
    if (!initialized) {
        return (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ opacity: 0.6, fontSize: 14 }}>Checking...</span>
            </div>
        );
    }

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
