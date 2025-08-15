"use client";

import React, { useMemo, useState } from "react";
import type { Game } from "./page";

type PatchPayload = {
    name?: string;
    summary?: string | null;
    release_year?: number | null;
    rating?: number | null;
};

export default function GameEditor({ initialData }: { initialData: Game }) {
    const [name, setName] = useState(initialData.name ?? "");
    const [summary, setSummary] = useState(initialData.summary ?? "");
    const [releaseYear, setReleaseYear] = useState<number | "">(
        typeof initialData.release_year === "number" ? initialData.release_year : ""
    );
    const [rating, setRating] = useState<number | "">(
        typeof initialData.rating === "number" ? initialData.rating : ""
    );

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [savedOk, setSavedOk] = useState(false);

    const id = initialData.id;

    const isDirty = useMemo(() => {
        return (
            name !== (initialData.name ?? "") ||
            (summary ?? "") !== (initialData.summary ?? "") ||
            (releaseYear === "" ? null : releaseYear) !== (initialData.release_year ?? null) ||
            (rating === "" ? null : rating) !== (initialData.rating ?? null)
        );
    }, [name, summary, releaseYear, rating, initialData]);

    async function onSave(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setError(null);
        setSavedOk(false);

        const payload: PatchPayload = {
            name: name.trim(),
            summary: summary.trim() || null,
            release_year: releaseYear === "" ? null : Number(releaseYear),
            rating: rating === "" ? null : Number(rating),
        };

        try {
            const res = await fetch(`/api/proxy/games/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(`PUT /api/proxy/games/${id} failed (${res.status}) ${text}`);
            }
            setSavedOk(true);
        } catch (e: any) {
            setError(e?.message ?? "Failed to save changes");
        } finally {
            setSaving(false);
        }
    }

    const row: React.CSSProperties = {
        display: "grid",
        gridTemplateColumns: "160px 1fr",
        gap: 8,
        alignItems: "center",
        marginBottom: 10,
    };

    const inputStyle: React.CSSProperties = {
        background: "#121212",
        color: "#eaeaea",
        border: "1px solid #262626",
        borderRadius: 8,
        padding: "8px 10px",
        outline: "none",
    };

    const textareaStyle: React.CSSProperties = {
        ...inputStyle,
        minHeight: 120,
        resize: "vertical" as const,
    };

    const btn: React.CSSProperties = {
        display: "inline-block",
        background: "#1b1b1b",
        color: "#eaeaea",
        border: "1px solid #2e2e2e",
        borderRadius: 8,
        padding: "8px 12px",
        cursor: "pointer",
        textDecoration: "none",
    };

    const disabledBtn: React.CSSProperties = {
        ...btn,
        opacity: 0.6,
        cursor: "not-allowed",
    };

    return (
        <form onSubmit={onSave}>
            <div style={row}>
                <label htmlFor="gname">Name</label>
                <input
                    id="gname"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={inputStyle}
                    required
                />
            </div>

            <div style={row}>
                <label htmlFor="gyear">Release Year</label>
                <input
                    id="gyear"
                    value={releaseYear}
                    onChange={(e) => {
                        const v = e.target.value.trim();
                        if (v === "") return setReleaseYear("");
                        const n = Number(v);
                        if (!Number.isFinite(n)) return;
                        setReleaseYear(n);
                    }}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="e.g. 1998"
                    style={inputStyle}
                />
            </div>

            <div style={row}>
                <label htmlFor="grating">Rating</label>
                <input
                    id="grating"
                    value={rating}
                    onChange={(e) => {
                        const v = e.target.value.trim();
                        if (v === "") return setRating("");
                        const n = Number(v);
                        if (!Number.isFinite(n)) return;
                        setRating(n);
                    }}
                    inputMode="decimal"
                    placeholder="0 - 100 (or whatever your API expects)"
                    style={inputStyle}
                />
            </div>

            <div style={row}>
                <label htmlFor="gsummary">Summary</label>
                <textarea
                    id="gsummary"
                    value={summary ?? ""}
                    onChange={(e) => setSummary(e.target.value)}
                    style={textareaStyle}
                />
            </div>

            {error && <div style={{ color: "#ff6666", marginBottom: 8 }}>{error}</div>}
            {savedOk && <div style={{ color: "#66ff99", marginBottom: 8 }}>Saved.</div>}

            <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" style={isDirty && !saving ? btn : disabledBtn} disabled={!isDirty || saving}>
                    {saving ? "Saving..." : "Save Changes"}
                </button>
                <button
                    type="button"
                    style={btn}
                    onClick={() => {
                        setName(initialData.name ?? "");
                        setSummary(initialData.summary ?? "");
                        setReleaseYear(typeof initialData.release_year === "number" ? initialData.release_year : "");
                        setRating(typeof initialData.rating === "number" ? initialData.rating : "");
                        setSavedOk(false);
                        setError(null);
                    }}
                >
                    Reset
                </button>
            </div>
        </form>
    );
}
