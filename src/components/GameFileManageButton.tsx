"use client";

import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { ManageFilesPanel } from "@/app/admin/files/manager/SearchAndManageFiles";

export default function GameFileManageButton({ gameId }: { gameId: number }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);

    function close() {
        setOpen(false);
        router.refresh();
    }

    return (
        <>
            <button type="button" className="gc-secondary-link gc-detail-action" onClick={() => setOpen(true)}>
                Manage files
            </button>

            {open ? (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Manage files"
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0,0,0,0.6)",
                        display: "grid",
                        placeItems: "center",
                        zIndex: 1000,
                    }}
                    onMouseDown={close}
                >
                    <div
                        onMouseDown={(e) => e.stopPropagation()}
                        style={{
                            width: "min(980px, 96vw)",
                            maxHeight: "90vh",
                            overflow: "auto",
                            background: "var(--gc-surface)",
                            border: "1px solid var(--gc-border)",
                            borderRadius: 12,
                            padding: 14,
                        }}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                            <div style={{ fontWeight: 700 }}>Files</div>
                            <button
                                type="button"
                                onClick={close}
                                style={{
                                    background: "var(--gc-surface-raised)",
                                    color: "var(--gc-text)",
                                    border: "1px solid var(--gc-border)",
                                    borderRadius: 8,
                                    padding: "6px 10px",
                                    cursor: "pointer",
                                }}
                            >
                                Close
                            </button>
                        </div>
                        <ManageFilesPanel gameId={gameId} />
                    </div>
                </div>
            ) : null}
        </>
    );
}
