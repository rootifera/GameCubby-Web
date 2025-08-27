"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useRef } from "react";

export default function AuthActions() {
    const [authed, setAuthed] = useState<boolean | null>(null);
    const [checking, setChecking] = useState(false);
    const lastCheckTime = useRef<number>(0);
    const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const check = useCallback(async (force = false) => {
        const now = Date.now();
        
        // Prevent rapid successive checks (debounce)
        if (!force && now - lastCheckTime.current < 1000) {
            return;
        }

        // If already checking, don't start another check
        if (checking) {
            return;
        }

        setChecking(true);
        lastCheckTime.current = now;

        try {
            const res = await fetch("/api/health", { 
                cache: "no-store",
                // Add timeout to prevent hanging requests
                signal: AbortSignal.timeout(3000)
            });
            
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
        check(true);

        // Set up periodic checks with longer interval to reduce API load
        const intervalId = setInterval(() => check(), 60000); // Check every minute instead of 30 seconds

        // Set up focus event listener with debouncing
        const handleFocus = () => {
            // Clear any existing timeout
            if (checkTimeoutRef.current) {
                clearTimeout(checkTimeoutRef.current);
            }
            
            // Debounce focus events
            checkTimeoutRef.current = setTimeout(() => {
                check();
            }, 200);
        };

        window.addEventListener("focus", handleFocus);
        
        // Also check on visibility change (when tab becomes visible)
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                handleFocus();
            }
        };
        
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            clearInterval(intervalId);
            window.removeEventListener("focus", handleFocus);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            if (checkTimeoutRef.current) {
                clearTimeout(checkTimeoutRef.current);
            }
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
