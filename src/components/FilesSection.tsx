"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/env";
import {
    UiFile,
    normalizeFiles,
    groupFiles,
    prettyCategory,
    GroupKey,
} from "@/lib/files";

async function fetchJSON<T>(url: string): Promise<T> {
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}${text ? `: ${text.slice(0, 160)}` : ""}`);
    return (text ? JSON.parse(text) : {}) as T;
}

/** Build a friendly default filename:
 *  - Prefer label + extension from path
 *  - Fallback to basename from path
 *  - Strip illegal filename chars
 */
function suggestFilename(f: UiFile): string {
    const baseFromPath = f.path.split("/").pop() || "download";
    const dot = baseFromPath.lastIndexOf(".");
    const ext = dot > -1 ? baseFromPath.slice(dot) : "";
    const raw = f.label?.trim() ? f.label.trim() + ext : baseFromPath;
    return raw.replace(/[\\/:*?"<>|]/g, "_");
}

export default function FilesSection({ gameId }: { gameId: number }) {
    const [files, setFiles] = useState<UiFile[] | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                setErr(null);

                const raw = await fetchJSON<unknown>(`${API_BASE_URL}/games/${gameId}/files/`);
                const normalized = normalizeFiles(raw);

                if (!cancelled) setFiles(normalized);
            } catch (e) {
                if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load files");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [gameId]);

    if (loading) return <SectionWrap><div style={{ opacity: 0.8 }}>Loading files…</div></SectionWrap>;
    if (err) return <SectionWrap><div style={{ color: "#fca5a5" }}>{err}</div></SectionWrap>;
    if (!files || files.length === 0) return <SectionWrap><div style={{ opacity: 0.7 }}>No files.</div></SectionWrap>;

    const grouped = groupFiles(files);

    const groupOrder: GroupKey[] = [
        "ISOs",
        "Images",
        "Save Files",
        "Patches and Updates",
        "Manuals and Docs",
        "Audio / OST",
        "Others",
    ];

    return (
        <SectionWrap>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Downloads</div>
            <div style={{ display: "grid", gap: 12 }}>
                {groupOrder.map((key) =>
                    grouped[key].length ? <FileGroup key={key} title={key} files={grouped[key]} /> : null
                )}
            </div>
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
        {children}
    </section>
);

function FileGroup({ title, files }: { title: string; files: UiFile[] }) {
    if (!files || files.length === 0) return null;
    return (
        <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>
                {title} <span style={{ opacity: 0.6, fontWeight: 400 }}>({files.length})</span>
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
                {files.map((f) => {
                    const fid = f.file_id;
                    const filename = suggestFilename(f);
                    return (
                        <li key={`${fid}-${f.path}`} style={rowStyle}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span
                      style={{
                          background: "#101010",
                          border: "1px solid #2b2b2b",
                          borderRadius: 6,
                          padding: "2px 6px",
                          fontSize: 11,
                          whiteSpace: "nowrap",
                      }}
                      title={f.category}
                  >
                    {prettyCategory(f.category)}
                  </span>
                                    <span style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {f.label || f.path.split("/").pop()}
                  </span>
                                </div>
                                <div style={{ fontSize: 12, opacity: 0.7, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {f.path}
                                </div>
                            </div>

                            {/* Download via proxy using guaranteed file_id, with a suggested filename */}
                            <a
                                href={`/api/proxy/downloads/${encodeURIComponent(String(fid))}`}
                                download={filename}
                                style={btnLink}
                                title={`file_id: ${f.file_id} • row id: ${f.id}`}
                            >
                                Download
                            </a>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

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
