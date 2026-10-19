"use client";

import { useEffect } from "react";

/**
 * Pings /api/health so auth state is refreshed, then navigates to `to`.
 * `to` arrives as a prop (escaped by React) and has already been restricted to a
 * same-site path by the page; nothing here builds HTML or script from it.
 */
export default function Redirect({ to }: { to: string }) {
    useEffect(() => {
        const go = () => window.location.replace(to);
        fetch(`/api/health?t=${Date.now()}`, {
            cache: "no-store",
            credentials: "same-origin",
            headers: { "Cache-Control": "no-cache" },
        }).then(go, go);
    }, [to]);

    return null;
}
