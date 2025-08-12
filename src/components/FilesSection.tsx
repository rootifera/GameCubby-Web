"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/env";

type FileItem = {
    id: number;            // DB row id (not used for download)
    file_id: number;       // <-- use this for downloads
    game: string;
    label: string;
    path: string;
    category?: "isos" | "images" | "files" | "other" | string;
};

async function fetchJSON<T>(url: string): Promise<T> {
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}${text ? `: ${text.slice(0,160)}` : ""}`);
    return (text ? JSON.parse(text) : {}) as T;
}

function groupByCategory(items: FileItem[]) {
    const groups: Record<string, FileItem[]> = { isos: [], images: [], files: [], other: [] };
    for (const f of items) {
        const key = (f.category ?? "").toLowerCase();
        if (key in groups) groups[key].push(f);
        else groups.other.push(f);
    }
    return groups;
}

export default function FilesSection({ gameId }: { gameId: number }) {
    const [items, setItems] = useState<FileItem[] | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                setErr(null);
                const list = await fetchJSON<FileItem[]>(
                    `${API_BASE_URL}/games/${gameId}/files/`
                );
                if (!cancelled) setItems(Array.isArray(list) ? list : []);
            } catch (e) {
                if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load files");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [gameId]);

    if (loading) return <SectionWrap><div style={{ opacity: 0.8 }}>Loading files…</div></SectionWrap>;
    if (err) return <SectionWrap><div style={{ color: "#fca5a5" }}>{err}</div></SectionWrap>;
    if (!items || items.length === 0) return <SectionWrap><div style={{ opacity: 0.7 }}>No files.</div></SectionWrap>;

    const groups = groupByCategory(items);

    return (
        <SectionWrap>
            {(["isos","images","files","other"] as const).map((cat) => {
                const arr = groups[cat];
                if (!arr?.length) return null;
                return (
                    <div key={cat} style={{ marginBottom: 12 }}>
                        <div style={{ fontWeight: 600, marginBottom: 6, textTransform: "capitalize" }}>
                            {cat} <span style={{ opacity: 0.6, fontWeight: 400 }}>({arr.length})</span>
                        </div>
                        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
                            {arr.map((f) => (
                                <li key={`${f.file_id}-${f.path}`} style={rowStyle}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                            {f.label || f.path.split("/").pop()}
                                        </div>
                                        <div style={{ fontSize: 12, opacity: 0.7, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                            {f.path}
                                        </div>
                                    </div>
                                    {/* IMPORTANT: download via proxy using file_id */}
                                    <a
                                        href={`/api/proxy/downloads/${encodeURIComponent(String(f.file_id))}`}
                                        style={btnLink}
                                    >
                                        Download
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                );
            })}
        </SectionWrap>
    );
}

/* styles */
const SectionWrap: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <section
        style={{
            margin: "12px 0 0 0",
            padding: 12,
            background: "#141414",
            border: "1px solid #262626",
            borderRadius: 10,
        }}
    >
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Files</div>
        {children}
    </section>
);

const rowStyle: React.CSSProperties = {
    display: "flex",
    gap: 10,
    alignItems: "center",
    border: "1px solid #222",
    background: "#121212",
    padding: "8px 10px",
    borderRadius: 8,
};

const btnLink: React.CSSProperties = {
    textDecoration: "none",
    color: "#dbeafe",
    border: "1px solid #3b82f6",
    background: "#1e293b",
    padding: "8px 10px",
    borderRadius: 8,
    whiteSpace: "nowrap",
};
