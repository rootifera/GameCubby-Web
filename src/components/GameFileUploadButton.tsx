"use client";

import { useRouter } from "next/navigation";
import React, { useState } from "react";
import type { FileCategory } from "@/lib/files";

const categories: { value: FileCategory; label: string }[] = [
    { value: "disc_image", label: "Disc Image" },
    { value: "screenshots", label: "Screenshot" },
    { value: "artwork_covers", label: "Artwork / Cover" },
    { value: "manuals_docs", label: "Manual / Doc" },
    { value: "audio_ost", label: "Audio / OST" },
    { value: "patch_update", label: "Patch / Update" },
    { value: "saves", label: "Save File" },
    { value: "other", label: "Other" },
];

export default function GameFileUploadButton({ gameId }: { gameId: number }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [label, setLabel] = useState("");
    const [category, setCategory] = useState<FileCategory | "">("");
    const [file, setFile] = useState<File | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    async function upload(e: React.FormEvent) {
        e.preventDefault();
        if (!file || !label.trim() || !category) {
            setError("Choose a file, label, and category.");
            return;
        }

        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            const form = new FormData();
            form.append("label", label.trim());
            form.append("category", category);
            form.append("file", file);

            const res = await fetch(`/api/admin/games/${gameId}/files/upload`, {
                method: "POST",
                body: form,
                cache: "no-store",
            });
            const text = await res.text();
            if (!res.ok) throw new Error(text || `Upload failed (${res.status})`);

            setNotice("Upload complete.");
            setLabel("");
            setCategory("");
            setFile(null);
            router.refresh();
        } catch (e: any) {
            setError(e?.message ?? "Upload failed");
        } finally {
            setBusy(false);
        }
    }

    const button: React.CSSProperties = {
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

    const input: React.CSSProperties = {
        background: "#121212",
        color: "#eaeaea",
        border: "1px solid #262626",
        borderRadius: 8,
        padding: "8px 10px",
        outline: "none",
        width: "100%",
    };

    return (
        <>
            <button type="button" style={button} onClick={() => setOpen(true)}>
                <span aria-hidden="true">↑</span> Upload
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
                    onMouseDown={() => setOpen(false)}
                >
                    <div
                        style={{
                            width: "min(980px, 96vw)",
                            maxHeight: "90vh",
                            overflow: "auto",
                            background: "#0f0f0f",
                            border: "1px solid #262626",
                            borderRadius: 12,
                            padding: 14,
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                            <div style={{ fontWeight: 700 }}>Upload File</div>
                            <button
                                type="button"
                                style={{
                                    background: "#151515",
                                    color: "#eaeaea",
                                    border: "1px solid #2b2b2b",
                                    borderRadius: 8,
                                    padding: "6px 10px",
                                    cursor: "pointer",
                                }}
                                onClick={() => setOpen(false)}
                            >
                                Close
                            </button>
                        </div>

                        {(error || notice) ? (
                            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                                {notice ? <div style={{ background: "#102418", border: "1px solid #214d2c", padding: 10, borderRadius: 8 }}>{notice}</div> : null}
                                {error ? <div style={{ background: "#3b0f12", border: "1px solid #5b1a1f", padding: 10, borderRadius: 8, color: "#ffd7d7" }}>{error}</div> : null}
                            </div>
                        ) : null}

                        <section
                            style={{
                                background: "#141414",
                                border: "1px solid #262626",
                                borderRadius: 10,
                                padding: 12,
                                marginTop: 12,
                            }}
                        >
                            <div style={{ fontWeight: 700, marginBottom: 8 }}>Upload file</div>
                            <form onSubmit={upload} style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 1fr auto" }}>
                                <label style={{ display: "grid", gap: 6 }}>
                                    <span style={{ opacity: 0.85, fontSize: 12 }}>File</span>
                                    <input type="file" required style={input} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                                </label>
                                <label style={{ display: "grid", gap: 6 }}>
                                    <span style={{ opacity: 0.85, fontSize: 12 }}>Label</span>
                                    <input value={label} required style={input} onChange={(e) => setLabel(e.target.value)} />
                                </label>
                                <label style={{ display: "grid", gap: 6 }}>
                                    <span style={{ opacity: 0.85, fontSize: 12 }}>Category</span>
                                    <select value={category} required style={input} onChange={(e) => setCategory((e.target.value || "") as FileCategory | "")}>
                                        <option value="">Choose category</option>
                                        {categories.map((c) => (
                                            <option key={c.value} value={c.value}>
                                                {c.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <div style={{ alignSelf: "end" }}>
                                    <button type="submit" style={{ ...button, background: "#1e293b", border: "1px solid #3b82f6" }} disabled={busy}>
                                        {busy ? "Uploading..." : "Upload"}
                                    </button>
                                </div>
                            </form>
                        </section>
                    </div>
                </div>
            ) : null}
        </>
    );
}
