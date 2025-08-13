"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function AuthActions() {
    const [authed, setAuthed] = useState<boolean | null>(null); // null = unknown (loading)
    const [checking, setChecking] = useState(false);

    async function check() {
        setChecking(true);
        try {
            const res = await fetch("/api/health", { cache: "no-store" });
            const data = (await res.json()) as { authed?: boolean };
            setAuthed(Boolean(data?.authed));
        } catch {
            setAuthed(null);
        } finally {
            setChecking(false);
        }
    }

    useEffect(() => {
        // initial
        void check();
        // refresh when tab gains focus
        const onFocus = () => void check();
        window.addEventListener("focus", onFocus);
        // periodic light refresh
        const id = setInterval(check, 30000);
        return () => {
            window.removeEventListener("focus", onFocus);
            clearInterval(id);
        };
    }, []);

    return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* While loading, keep layout stable */}
            {authed === null || checking ? (
                <span style={{ opacity: 0.6, fontSize: 12 }}>Checking…</span>
            ) : authed ? (
                <>
                    <Link href="/admin" style={btnPrimary}>Admin Panel</Link>
                    <Link href="/admin/logout" style={btnGhost}>Logout</Link>
                </>
            ) : (
                <Link href="/admin/login" style={btnPrimary}>Login</Link>
            )}
        </div>
    );
}

/* ---- tiny header button styles to match your UI ---- */
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
