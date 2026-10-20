"use client";

import { useEffect } from "react";

/**
 * Stops the mouse wheel from changing the value of number inputs (and scrolling the page while
 * hovering one). One delegated listener on the document replaces the old inline <script> that
 * attached a listener to every input with a MutationObserver -- and, being a normal client
 * component, it needs no CSP exception for inline script.
 */
export default function NumberInputWheelGuard() {
    useEffect(() => {
        const onWheel = (e: WheelEvent) => {
            const t = e.target;
            if (t instanceof HTMLInputElement && t.type === "number") e.preventDefault();
        };
        document.addEventListener("wheel", onWheel, { passive: false });
        return () => document.removeEventListener("wheel", onWheel);
    }, []);
    return null;
}
