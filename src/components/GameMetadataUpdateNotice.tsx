"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type MetadataStatus = {
    checked?: boolean;
    update_available?: boolean;
    message?: string;
};

export default function GameMetadataUpdateNotice({ gameId, isAdmin }: { gameId: number; isAdmin: boolean }) {
    const router = useRouter();
    const [message, setMessage] = useState<string | null>(null);
    const [updating, setUpdating] = useState(false);
    const [updateError, setUpdateError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | undefined;

        async function check(attempt = 0): Promise<void> {
            try {
                const response = await fetch(`/api/proxy/games/${gameId}/metadata-update-status`, { cache: "no-store" });
                if (!response.ok) return; // Status checking must never disrupt viewing a game.
                const status = await response.json() as MetadataStatus;
                if (cancelled) return;
                if (status.checked && status.update_available) {
                    setMessage(status.message || "Metadata update available from IGDB.");
                    return;
                }
                // The backend may still be checking after the game page opens.
                if (!status.checked && attempt < 4) timer = setTimeout(() => void check(attempt + 1), 1200);
            } catch {
                // The game page remains usable when the background check is unavailable.
            }
        }

        void check();
        return () => { cancelled = true; if (timer) clearTimeout(timer); };
    }, [gameId]);

    async function updateMetadata() {
        setUpdating(true);
        setUpdateError(null);
        try {
            const response = await fetch(`/api/admin/games/${gameId}/refresh_metadata`, { method: "POST" });
            if (!response.ok) throw new Error((await response.text()) || `${response.status} ${response.statusText}`);
            setMessage(null);
            router.refresh();
        } catch (error) {
            setUpdateError(error instanceof Error ? error.message : "Unable to update metadata.");
        } finally {
            setUpdating(false);
        }
    }

    if (!message) return null;
    return <span role="status" title={message} style={{ display: "inline-flex", alignItems: "center", gap: 7, border: "1px solid #826b22", background: "#3b3210", color: "#fff0b3", padding: "5px 8px", borderRadius: 999, fontSize: 12 }}>
        <span>Metadata update available</span>
        {isAdmin ? <button type="button" onClick={() => void updateMetadata()} disabled={updating} style={{ border: 0, borderRadius: 6, padding: "3px 6px", background: "#826b22", color: "#fff", cursor: updating ? "default" : "pointer", fontSize: 12 }}>{updating ? "Updating…" : "Update"}</button> : null}
        {updateError ? <span title={updateError} style={{ color: "#ffb4b4" }}>Update failed</span> : null}
    </span>;
}
