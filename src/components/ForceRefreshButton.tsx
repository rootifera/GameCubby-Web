"use client";

import { useState } from "react";

export default function ForceRefreshButton() {
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleForceRefresh = async () => {
        setIsRefreshing(true);
        try {
            const response = await fetch("/api/stats/force_refresh", {
                method: "POST",
                cache: "no-store",
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // Refresh the page to show updated stats
            window.location.reload();
        } catch (error) {
            console.error("Failed to force refresh stats:", error);
            // You could add a toast notification here if desired
        } finally {
            setIsRefreshing(false);
        }
    };

    return (
        <button
            onClick={handleForceRefresh}
            disabled={isRefreshing}
            style={{
                background: "#404040",
                border: "1px solid #555",
                borderRadius: 6,
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.2s ease",
                opacity: isRefreshing ? 0.6 : 1,
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.background = "#505050";
                e.currentTarget.style.borderColor = "#666";
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = "#404040";
                e.currentTarget.style.borderColor = "#555";
            }}
            title="Force Refresh Statistics. (Auto refresh happens every 5 minutes)"
        >
            <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                    color: "#e0e0e0",
                    transform: isRefreshing ? "rotate(360deg)" : "rotate(0deg)",
                    transition: "transform 0.5s ease",
                }}
            >
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                <path d="M3 21v-5h5" />
            </svg>
        </button>
    );
}
