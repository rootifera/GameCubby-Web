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

    const actionBtn: React.CSSProperties = {
        background: "#6b7280",
        color: "#ffffff",
        padding: "6px 12px",
        borderRadius: 6,
        fontSize: 14,
        border: "none",
        textDecoration: "none",
        fontWeight: 500,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        cursor: "pointer",
        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
    };

    return (
        <>
            <button type="button" style={actionBtn} onClick={() => setOpen(true)}>
                <span aria-hidden="true">🗂️</span> Manage Files
            </button>

            {open ? (
                <div
                    role="dialog"
                    aria-modal="true"
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
                            background: "#0f0f0f",
                            border: "1px solid #262626",
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
                                    background: "#151515",
                                    color: "#eaeaea",
                                    border: "1px solid #2b2b2b",
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
