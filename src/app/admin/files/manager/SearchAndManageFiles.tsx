// src/app/admin/files/manager/SearchAndManageFiles.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import TagChipsAutocomplete from "@/components/TagChipsAutocomplete";
import CoverThumb from "@/components/CoverThumb";
import {
    UiFile,
    normalizeFiles,
    groupFiles,
    prettyCategory,
    GroupKey,
    FileCategory,
} from "@/lib/files";

/* ------------ search types ------------ */
type Named = { id: number; name: string };
type GameListItem = {
    id: number;
    name: string;
    cover_url?: string | null;
    release_date?: number | null; // year or unix
    platforms?: Named[];
    rating?: number | null;
    igdb_id?: number | null;
};

/* ------------ helpers ------------ */
function toYearNumber(n?: number | null): number | null {
    if (n == null) return null;
    if (n >= 1000 && n <= 3000) return n;
    if (n >= 1_000_000_000_000) return new Date(n).getUTCFullYear(); // ms
    if (n >= 1_000_000_000) return new Date(n * 1000).getUTCFullYear(); // sec
    return n;
}
function toYearLabel(n?: number | null): string {
    const y = toYearNumber(n);
    return y == null ? "—" : String(y);
}
function parseIdsCSV(csv: string): number[] {
    return csv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => Number(s))
        .filter((n) => Number.isFinite(n));
}
/** Build query equivalent to Basic Search (single platform). */
function buildBasicQuery(params: {
    q: string;
    year: string;
    platform_id: string; // single-select
    tag_ids_csv: string;
    match_mode: "any" | "all" | "exact";
    size: number;
    page: number;
}) {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q); // proxy maps q -> name
    if (params.year) sp.set("year", params.year);
    if (params.platform_id) sp.set("platform_id", params.platform_id);
    if (params.match_mode) sp.set("match_mode", params.match_mode);
    const tIds = params.tag_ids_csv ? parseIdsCSV(params.tag_ids_csv) : [];
    for (const t of tIds) sp.append("tag_ids", String(t));
    sp.set("size", String(params.size));
    sp.set("page", String(params.page));
    return sp.toString();
}

/** Make a stable “title key” to dedupe results:
 *  - prefer igdb_id (>0)
 *  - otherwise lowercased name
 */
function titleKeyOf(g: GameListItem): string {
    if (typeof g.igdb_id === "number" && g.igdb_id > 0) return `igdb:${g.igdb_id}`;
    return `name:${(g.name || "").trim().toLowerCase()}`;
}

/* ------------ tiny Modal ------------ */
function Modal({
                   open,
                   onClose,
                   children,
                   title,
               }: {
    open: boolean;
    onClose: () => void;
    children: React.ReactNode;
    title?: string;
}) {
    if (!open) return null;
    return (
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
            onMouseDown={onClose}
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
                    <div style={{ fontWeight: 700 }}>{title}</div>
                    <button
                        type="button"
                        onClick={onClose}
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
                {children}
            </div>
        </div>
    );
}

/* ------------ Manage panel inside modal ------------ */
function ManageFilesPanel({ gameId }: { gameId: number }) {
    const [files, setFiles] = useState<UiFile[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    const [busy, setBusy] = useState<string | null>(null); // general op message (upload/delete/etc.)
    const [notice, setNotice] = useState<string | null>(null); // success/info
    const [editId, setEditId] = useState<number | null>(null);
    const [editLabel, setEditLabel] = useState<string>("");

    // Upload form state
    const [uplLabel, setUplLabel] = useState("");
    const [uplCat, setUplCat] = useState<FileCategory | "">("");
    const [uplFile, setUplFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    const catOptions: { value: FileCategory; label: string }[] = [
        { value: "disc_image", label: "Disc Image" },
        { value: "screenshots", label: "Screenshot" },
        { value: "artwork_covers", label: "Artwork / Cover" },
        { value: "manuals_docs", label: "Manual / Doc" },
        { value: "audio_ost", label: "Audio / OST" },
        { value: "patch_update", label: "Patch / Update" },
        { value: "saves", label: "Save File" },
        { value: "other", label: "Other" },
    ];

    async function loadFiles() {
        setLoading(true);
        setErr(null);
        setNotice(null);
        try {
            // ✅ Use same-origin proxy to avoid CORS
            const res = await fetch(`/api/proxy/games/${gameId}/files?_=${Date.now()}`, {
                cache: "no-store",
                headers: { Accept: "application/json" },
            });
            const text = await res.text();
            if (!res.ok) throw new Error(`${res.status} ${res.statusText}${text ? `: ${text.slice(0, 160)}` : ""}`);
            const normalized = normalizeFiles(text ? JSON.parse(text) : []);
            setFiles(normalized);
        } catch (e: any) {
            setErr(e?.message ?? "Failed to load files");
            setFiles([]);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadFiles();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameId]);

    async function doDelete(fid: number) {
        if (!confirm("Delete this file permanently?")) return;
        setBusy("Deleting…");
        setNotice(null);
        try {
            const res = await fetch(`/api/admin/games/${gameId}/files/${fid}`, { method: "DELETE", cache: "no-store" });
            if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(`Delete failed (${res.status}) ${text}`);
            }
            // Optimistic remove
            setFiles((prev) => (prev ? prev.filter((f) => f.file_id !== fid) : prev));
            setNotice("File deleted.");
        } catch (e: any) {
            setErr(e?.message ?? "Delete failed");
        } finally {
            setBusy(null);
        }
    }

    function startEditLabel(fid: number, current: string) {
        setEditId(fid);
        setEditLabel(current || "");
    }
    async function saveEditLabel() {
        if (editId == null) return;
        const label = editLabel.trim();
        setBusy("Saving label…");
        setNotice(null);
        try {
            const res = await fetch(`/api/admin/games/${gameId}/files/${editId}/label`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ label }),
            });
            const text = await res.text();
            if (!res.ok) throw new Error(`Label update failed (${res.status}) ${text}`);
            // Response returns updated file record; update local list if present
            const updated = text ? (JSON.parse(text) as Partial<UiFile> & { id?: number; file_id?: number; label?: string }) : null;
            setFiles((prev) => {
                if (!prev) return prev;
                return prev.map((f) =>
                    f.file_id === (updated?.file_id ?? editId) ? { ...f, label: updated?.label ?? label } : f
                );
            });
            setEditId(null);
            setEditLabel("");
            setNotice("Label updated.");
        } catch (e: any) {
            setErr(e?.message ?? "Label update failed");
        } finally {
            setBusy(null);
        }
    }
    function cancelEditLabel() {
        setEditId(null);
        setEditLabel("");
    }

    async function doUpload(e: React.FormEvent) {
        e.preventDefault();
        if (!uplFile) {
            setErr("Please choose a file to upload.");
            return;
        }
        setUploading(true);
        setBusy("Uploading…");
        setNotice(null);
        try {
            const fd = new FormData();
            // Common FastAPI style: field name "file"
            fd.append("file", uplFile);
            if (uplLabel.trim()) fd.append("label", uplLabel.trim());
            if (uplCat) fd.append("category", uplCat);

            const res = await fetch(`/api/admin/games/${gameId}/files/upload`, {
                method: "POST",
                body: fd,
                cache: "no-store",
            });
            const text = await res.text();
            if (!res.ok) {
                // Parse error response to provide user-friendly messages
                let errorMessage = `Upload failed (${res.status})`;
                try {
                    if (text) {
                        const errorData = JSON.parse(text);
                        if (errorData.detail && Array.isArray(errorData.detail)) {
                            const missingFields = errorData.detail
                                .filter((err: any) => err.type === "missing")
                                .map((err: any) => err.loc[1]);
                            
                            if (missingFields.length > 0) {
                                if (missingFields.length === 2) {
                                    errorMessage = "Please select both a label and category for the file.";
                                } else if (missingFields.includes("label")) {
                                    errorMessage = "Please select a label for the file.";
                                } else if (missingFields.includes("category")) {
                                    errorMessage = "Please select a category for the file.";
                                } else {
                                    errorMessage = `Please provide: ${missingFields.join(", ")}`;
                                }
                            } else {
                                errorMessage = `Upload failed: ${text}`;
                            }
                        } else {
                            errorMessage = `Upload failed: ${text}`;
                        }
                    }
                } catch {
                    // If parsing fails, fall back to original error message
                    errorMessage = `Upload failed (${res.status}) ${text}`;
                }
                throw new Error(errorMessage);
            }
            // Reload list to reflect new file
            await loadFiles();
            setUplFile(null);
            setUplLabel("");
            setUplCat("");
            (document.getElementById("upl-file-input") as HTMLInputElement | null)?.value &&
            ((document.getElementById("upl-file-input") as HTMLInputElement).value = "");
            setNotice("Upload complete.");
        } catch (e: any) {
            setErr(e?.message ?? "Upload failed");
        } finally {
            setUploading(false);
            setBusy(null);
        }
    }

    async function doSync() {
        setBusy("Syncing files…");
        setNotice(null);
        try {
            const res = await fetch(`/api/admin/games/${gameId}/files/sync-files`, {
                method: "POST",
                cache: "no-store",
                headers: { Accept: "application/json" },
            });
            const text = await res.text();
            // The API says 200 + object { ... } — show detail if present
            let msg = "Sync requested.";
            try {
                const obj = text ? (JSON.parse(text) as Record<string, any>) : {};
                if (typeof obj.detail === "string") msg = obj.detail;
                else if (typeof obj.message === "string") msg = obj.message;
            } catch {
                /* ignore parse */
            }
            setNotice(msg);
            // Refresh files after sync kick (in case it already detected changes quickly)
            await loadFiles();
        } catch (e: any) {
            setErr(e?.message ?? "Sync failed");
        } finally {
            setBusy(null);
        }
    }

    /* ---- styles ---- */
    const input = {
        background: "#121212",
        color: "#eaeaea",
        border: "1px solid #262626",
        borderRadius: 8,
        padding: "8px 10px",
        outline: "none",
    } as const;
    const btn: React.CSSProperties = {
        display: "inline-block",
        background: "#1b1b1b",
        color: "#eaeaea",
        border: "1px solid #2e2e2e",
        borderRadius: 8,
        padding: "8px 12px",
        textDecoration: "none",
        whiteSpace: "nowrap",
        cursor: "pointer",
    };
    const primaryBtn: React.CSSProperties = {
        ...btn,
        background: "#1e293b",
        border: "1px solid #3b82f6",
        color: "#fff",
        fontWeight: 600,
    };
    const dangerBtn: React.CSSProperties = {
        ...btn,
        background: "#3b1e1e",
        border: "1px solid #c24141",
    };
    const chip: React.CSSProperties = {
        background: "#101010",
        border: "1px solid #2b2b2b",
        borderRadius: 6,
        padding: "2px 6px",
        fontSize: 11,
        whiteSpace: "nowrap",
    };

    const grouped = useMemo(() => (files ? groupFiles(files) : null), [files]);
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
        <div style={{ display: "grid", gap: 14 }}>
            {/* status row */}
            {(busy || err || notice) && (
                <div style={{ display: "grid", gap: 8 }}>
                    {busy && (
                        <div style={{ background: "#1b1b1b", border: "1px solid #2e2e2e", padding: 10, borderRadius: 8 }}>
                            {busy}
                        </div>
                    )}
                    {notice && (
                        <div style={{ background: "#102418", border: "1px solid #214d2c", padding: 10, borderRadius: 8 }}>
                            {notice}
                        </div>
                    )}
                    {err && (
                        <div style={{ background: "#3b0f12", border: "1px solid #5b1a1f", padding: 10, borderRadius: 8, color: "#ffd7d7" }}>
                            {err}
                        </div>
                    )}
                </div>
            )}

            {/* Upload */}
            <section
                style={{
                    background: "#141414",
                    border: "1px solid #262626",
                    borderRadius: 10,
                    padding: 12,
                }}
            >
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Upload file</div>
                <form onSubmit={doUpload} style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 1fr auto" }}>
                    <label style={{ display: "grid", gap: 6 }}>
                        <span style={{ opacity: 0.85, fontSize: 12 }}>File</span>
                        <input
                            id="upl-file-input"
                            type="file"
                            onChange={(e) => setUplFile(e.target.files?.[0] ?? null)}
                            style={input}
                            required
                        />
                    </label>
                    <label style={{ display: "grid", gap: 6 }}>
                        <span style={{ opacity: 0.85, fontSize: 12 }}>Label (optional)</span>
                        <input value={uplLabel} onChange={(e) => setUplLabel(e.target.value)} style={input} />
                    </label>
                    <label style={{ display: "grid", gap: 6 }}>
                        <span style={{ opacity: 0.85, fontSize: 12 }}>Category</span>
                        <select
                            value={uplCat}
                            onChange={(e) => setUplCat((e.target.value || "") as FileCategory | "")}
                            style={input}
                        >
                            <option value="">(none)</option>
                            {catOptions.map((o) => (
                                <option key={o.value} value={o.value}>
                                    {o.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <div style={{ alignSelf: "end" }}>
                        <button type="submit" style={primaryBtn} disabled={uploading}>
                            {uploading ? "Uploading…" : "Upload"}
                        </button>
                    </div>
                </form>
            </section>

            {/* Files list */}
            <section
                style={{
                    background: "#141414",
                    border: "1px solid #262626",
                    borderRadius: 10,
                    padding: 12,
                }}
            >
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Files</div>
                {loading ? (
                    <div style={{ opacity: 0.8 }}>Loading files…</div>
                ) : !files || files.length === 0 ? (
                    <div style={{ opacity: 0.75 }}>No files.</div>
                ) : (
                    <div style={{ display: "grid", gap: 12 }}>
                        {groupOrder.map((key) =>
                            grouped && grouped[key].length ? (
                                <div key={key}>
                                    <div style={{ fontWeight: 600, marginBottom: 6 }}>
                                        {key} <span style={{ opacity: 0.6, fontWeight: 400 }}>({grouped[key].length})</span>
                                    </div>
                                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
                                        {grouped[key].map((f) => {
                                            const isEditing = editId === f.file_id;
                                            const displayName = f.label || f.path.split("/").pop() || f.path;

                                            return (
                                                <li
                                                    key={`${f.file_id}-${f.path}`}
                                                    style={{
                                                        display: "grid",
                                                        gridTemplateColumns: "1fr auto auto auto",
                                                        gap: 10,
                                                        alignItems: "center",
                                                        border: "1px solid #222",
                                                        background: "#121212",
                                                        padding: "8px 10px",
                                                        borderRadius: 8,
                                                    }}
                                                >
                                                    {/* left info */}
                                                    <div style={{ minWidth: 0 }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                              <span style={{ background: "#101010", border: "1px solid #2b2b2b", borderRadius: 6, padding: "2px 6px", fontSize: 11, whiteSpace: "nowrap" }} title={f.category}>
                                {prettyCategory(f.category)}
                              </span>
                                                            {!isEditing ? (
                                                                <span
                                                                    style={{
                                                                        fontWeight: 600,
                                                                        whiteSpace: "nowrap",
                                                                        overflow: "hidden",
                                                                        textOverflow: "ellipsis",
                                                                    }}
                                                                    title={displayName}
                                                                >
                                  {displayName}
                                </span>
                                                            ) : (
                                                                <input
                                                                    value={editLabel}
                                                                    onChange={(e) => setEditLabel(e.target.value)}
                                                                    style={{ background: "#1a1a1a", border: "1px solid #2b2b2b", borderRadius: 6, width: "100%", padding: "6px 8px", color: "#eaeaea" }}
                                                                    placeholder="New label…"
                                                                />
                                                            )}
                                                        </div>
                                                        <div
                                                            style={{
                                                                fontSize: 12,
                                                                opacity: 0.7,
                                                                whiteSpace: "nowrap",
                                                                overflow: "hidden",
                                                                textOverflow: "ellipsis",
                                                            }}
                                                            title={f.path}
                                                        >
                                                            {f.path.split("/").pop()}
                                                        </div>
                                                    </div>

                                                    {/* actions */}
                                                    {!isEditing ? (
                                                        <>
                                                            <a
                                                                href={`/api/proxy/downloads/${encodeURIComponent(String(f.file_id))}`}
                                                                style={{
                                                                    display: "inline-block",
                                                                    background: "#1e293b",
                                                                    color: "#dbeafe",
                                                                    border: "1px solid #3b82f6",
                                                                    borderRadius: 8,
                                                                    padding: "8px 12px",
                                                                    textDecoration: "none",
                                                                    whiteSpace: "nowrap",
                                                                    cursor: "pointer",
                                                                }}
                                                                download
                                                                title={`file_id: ${f.file_id} • row id: ${f.id}`}
                                                            >
                                                                Download
                                                            </a>
                                                            <button
                                                                type="button"
                                                                style={{ display: "inline-block", background: "#1b1b1b", color: "#eaeaea", border: "1px solid #2e2e2e", borderRadius: 8, padding: "8px 12px", whiteSpace: "nowrap", cursor: "pointer" }}
                                                                onClick={() => startEditLabel(f.file_id, f.label || "")}
                                                            >
                                                                Edit Label
                                                            </button>
                                                            <button
                                                                type="button"
                                                                style={{ display: "inline-block", background: "#3b1e1e", color: "#eaeaea", border: "1px solid #c24141", borderRadius: 8, padding: "8px 12px", whiteSpace: "nowrap", cursor: "pointer" }}
                                                                onClick={() => void doDelete(f.file_id)}
                                                            >
                                                                Delete
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button type="button" style={{ display: "inline-block", background: "#1e293b", color: "#fff", border: "1px solid #3b82f6", borderRadius: 8, padding: "8px 12px", whiteSpace: "nowrap", cursor: "pointer", fontWeight: 600 }} onClick={saveEditLabel}>
                                                                Save
                                                            </button>
                                                            <button type="button" style={{ display: "inline-block", background: "#1b1b1b", color: "#eaeaea", border: "1px solid #2e2e2e", borderRadius: 8, padding: "8px 12px", whiteSpace: "nowrap", cursor: "pointer" }} onClick={cancelEditLabel}>
                                                                Cancel
                                                            </button>
                                                            <div /> {/* spacer to keep grid width consistent */}
                                                        </>
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            ) : null
                        )}
                    </div>
                )}
            </section>

            {/* Per-game sync */}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="button" style={btn} onClick={() => void doSync()}>
                    Sync Files for This Game
                </button>
            </div>
        </div>
    );
}

/* ------------ main component (search + modal) ------------ */
export default function SearchAndManageFiles({
                                                 initialPlatforms,
                                             }: {
    initialPlatforms: Named[];
}) {
    // Filters (Basic Search — single platform)
    const [q, setQ] = useState("");
    const [year, setYear] = useState("");
    const [platformId, setPlatformId] = useState<string>(""); // SINGLE
    const [tagCsv, setTagCsv] = useState(""); // synced from hidden input rendered by TagChipsAutocomplete
    const [matchMode, setMatchMode] = useState<"any" | "all" | "exact">("any");
    const [size, setSize] = useState(20);

    // force remount for TagChipsAutocomplete on reset
    const [resetKey, setResetKey] = useState(0);

    // Data
    const [results, setResults] = useState<GameListItem[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    // Global sync status
    const [gBusy, setGBusy] = useState(false);
    const [gErr, setGErr] = useState<string | null>(null);
    const [gNotice, setGNotice] = useState<string | null>(null);

    // Observe TagChipsAutocomplete's hidden input value (name="tag_ids")
    const tagsHostRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const host = tagsHostRef.current;
        if (!host) return;

        const input = host.querySelector('input[name="tag_ids"]') as HTMLInputElement | null;
        if (!input) return;

        const updateFromInput = () => setTagCsv(input.value || "");
        updateFromInput();

        input.addEventListener("input", updateFromInput);
        input.addEventListener("change", updateFromInput);

        const mo = new MutationObserver(updateFromInput);
        mo.observe(input, { attributes: true, attributeFilter: ["value"] });

        return () => {
            input.removeEventListener("input", updateFromInput);
            input.removeEventListener("change", updateFromInput);
            mo.disconnect();
        };
    }, [tagsHostRef.current, resetKey]);

    // Reset everything (including Tags) — remount the tags widget
    function resetAll() {
        setQ("");
        setYear("");
        setPlatformId("");
        setMatchMode("any");
        setSize(20);
        setTagCsv("");
        setResults(null);
        setErr(null);
        setResetKey((k) => k + 1);

        const host = tagsHostRef.current;
        const input = host?.querySelector('input[name="tag_ids"]') as HTMLInputElement | null;
        if (input) {
            input.value = "";
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
        }
    }

    // Run search with debounce when filters change
    useEffect(() => {
        const hasAny = q.trim() || year.trim() || platformId.trim() || tagCsv.trim();
        if (!hasAny) {
            setResults(null);
            setErr(null);
            return;
        }

        const ctrl = new AbortController();
        const timer = setTimeout(async () => {
            setLoading(true);
            setErr(null);
            try {
                const qs = buildBasicQuery({
                    q: q.trim(),
                    year: year.trim(),
                    platform_id: platformId.trim(),
                    tag_ids_csv: tagCsv,
                    match_mode: matchMode,
                    size,
                    page: 1,
                });

                const url = `/api/proxy/search/basic?${qs}`;
                const res = await fetch(url, {
                    method: "GET",
                    headers: { Accept: "application/json" },
                    cache: "no-store",
                    signal: ctrl.signal,
                });
                if (!res.ok) {
                    const text = await res.text().catch(() => "");
                    throw new Error(`Search failed (${res.status}) ${text}`);
                }
                const data = await res.json();
                const list: GameListItem[] = Array.isArray(data) ? data : data?.results ?? [];
                setResults(Array.isArray(list) ? list.slice(0, size) : []);
            } catch (e: any) {
                if (e?.name !== "AbortError") setErr(e?.message ?? "Search error");
            } finally {
                setLoading(false);
            }
        }, 250);

        return () => {
            ctrl.abort();
            clearTimeout(timer);
        };
    }, [q, year, platformId, tagCsv, matchMode, size]);

    // Dedupe by IGDB id (if present), else by lowercased name
    const deduped = useMemo(() => {
        if (!results) return null;
        const seen = new Set<string>();
        const out: GameListItem[] = [];
        for (const g of results) {
            const k = titleKeyOf(g);
            if (seen.has(k)) continue;
            seen.add(k);
            out.push(g);
        }
        return out;
    }, [results]);

    // Modal state (selected representative game id & title)
    const [open, setOpen] = useState(false);
    const [sel, setSel] = useState<{ id: number; title: string; cover?: string | null } | null>(null);

    function openManage(g: GameListItem) {
        setSel({ id: g.id, title: g.name, cover: g.cover_url ?? null });
        setOpen(true);
    }

    async function doGlobalSync() {
        setGBusy(true);
        setGErr(null);
        setGNotice(null);
        try {
            const res = await fetch("/api/admin/files/sync-all", {
                method: "POST",
                cache: "no-store",
                headers: { Accept: "application/json" },
            });
            const text = await res.text();
            if (!res.ok) throw new Error(`Sync-all failed (${res.status}) ${text}`);
            // API returns something like { status: "started", detail: "..."}
            let status = "started";
            let detail = "Sync requested.";
            try {
                const obj = text ? (JSON.parse(text) as Record<string, any>) : {};
                if (typeof obj.status === "string") status = obj.status;
                if (typeof obj.detail === "string") detail = obj.detail;
            } catch {
                /* ignore parse errors */
            }
            setGNotice(`${status.toUpperCase()}: ${detail}`);
        } catch (e: any) {
            setGErr(e?.message ?? "Sync-all failed");
        } finally {
            setGBusy(false);
        }
    }

    /* ---- styles ---- */
    const input = {
        background: "#121212",
        color: "#eaeaea",
        border: "1px solid #262626",
        borderRadius: 8,
        padding: "8px 10px",
        outline: "none",
    } as const;

    const btn: React.CSSProperties = {
        display: "inline-block",
        background: "#1b1b1b",
        color: "#eaeaea",
        border: "1px solid #2e2e2e",
        borderRadius: 8,
        padding: "8px 12px",
        textDecoration: "none",
        whiteSpace: "nowrap",
        cursor: "pointer",
    };

    const primaryBtn: React.CSSProperties = {
        ...btn,
        background: "#1e293b",
        border: "1px solid #3b82f6",
        color: "#fff",
        fontWeight: 600,
    };

    return (
        <div>
            {/* Filters — Basic Search with single-select platform */}
            <div style={{ display: "grid", gap: 12, marginBottom: 12 }}>
                <input
                    placeholder="Search by game name…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    style={{ ...input }}
                />

                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "200px 350px" }}>
                    <label style={{ display: "grid", gap: 6 }}>
                        <span style={{ opacity: 0.85, fontSize: 12 }}>Year (exact)</span>
                        <input
                            value={year}
                            onChange={(e) => setYear(e.target.value.replace(/[^\d]/g, ""))}
                            inputMode="numeric"
                            placeholder="1998"
                            style={{ ...input }}
                        />
                    </label>

                    {/* Keep it simple for now (native select) */}
                    <label style={{ display: "grid", gap: 6 }}>
                        <span style={{ opacity: 0.85, fontSize: 12 }}>Platform</span>
                        <select
                            value={platformId}
                            onChange={(e) => setPlatformId(e.target.value)}
                            style={{ ...input }}
                        >
                            <option value="">Any</option>
                            {initialPlatforms
                                .slice()
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map((p) => (
                                    <option key={p.id} value={String(p.id)}>
                                        {p.name}
                                    </option>
                                ))}
                        </select>
                    </label>
                </div>

                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 160px" }}>
                    {/* Tags — uses existing component; we read its hidden input value */}
                    <div ref={tagsHostRef} key={resetKey}>
                        <TagChipsAutocomplete label="Tags" name="tag_ids" suggestKind="tags" defaultSelectedIds={[]} />
                    </div>

                    <label style={{ display: "grid", gap: 6 }}>
                        <span style={{ opacity: 0.85, fontSize: 12 }}>Tag match</span>
                        <select
                            value={matchMode}
                            onChange={(e) => setMatchMode((e.target.value as "any" | "all" | "exact") ?? "any")}
                            style={{ ...input }}
                        >
                            <option value="any">Any</option>
                            <option value="all">All</option>
                            <option value="exact">Exact</option>
                        </select>
                    </label>
                </div>

                {/* Reset row */}
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button type="button" onClick={resetAll} style={btn}>
                        Reset
                    </button>
                </div>

                <label style={{ display: "grid", gap: 6, maxWidth: 160 }}>
                    <span style={{ opacity: 0.85, fontSize: 12 }}>Page size</span>
                    <input
                        value={String(size)}
                        onChange={(e) => {
                            const n = Number(e.target.value.replace(/[^\d]/g, ""));
                            if (Number.isFinite(n) && n > 0 && n <= 100) setSize(n);
                        }}
                        inputMode="numeric"
                        style={{ ...input }}
                    />
                </label>
            </div>

            {loading && <div style={{ opacity: 0.8, marginTop: 8 }}>Searching…</div>}
            {err && <div style={{ color: "#ff6666", marginTop: 8 }}>{err}</div>}

            {!loading && !err && deduped && deduped.length === 0 && (
                <div style={{ opacity: 0.75, marginTop: 8 }}>No matches.</div>
            )}

            {!loading && !err && deduped && deduped.length > 0 && (
                <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                    {deduped.map((g) => (
                        <div
                            key={`${titleKeyOf(g)}-${g.id}`}
                            style={{
                                display: "grid",
                                gridTemplateColumns: "auto 1fr auto",
                                gap: 12,
                                alignItems: "center",
                                border: "1px solid #262626",
                                borderRadius: 10,
                                padding: 8,
                                background: "#0f0f0f",
                            }}
                        >
                            {/* cover */}
                            <div style={{ display: "inline-block", flexShrink: 0 }}>
                                <CoverThumb
                                    name={g.name}
                                    coverUrl={g.cover_url ?? undefined}
                                    width={48}
                                    height={64}
                                    rounded
                                />
                            </div>

                            {/* info */}
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 700 }}>{g.name}</div>
                                <div style={{ fontSize: 12, opacity: 0.8 }}>
                                    {toYearLabel(g.release_date)}
                                    {g.platforms?.length ? ` • ${g.platforms.map((p) => p.name).join(", ")}` : ""}
                                    {typeof g.rating === "number" ? ` • ★ ${g.rating}` : ""}
                                </div>
                            </div>

                            {/* open modal */}
                            <button
                                type="button"
                                style={primaryBtn}
                                onClick={() => openManage(g)}
                                aria-label={`Manage files for ${g.name}`}
                            >
                                Manage Files
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal renders the full manager for the representative game id */}
            <Modal open={open} onClose={() => setOpen(false)} title={sel?.title || "Files"}>
                {sel ? <ManageFilesPanel gameId={sel.id} /> : null}
            </Modal>

            {/* ---------------- Global Sync (system-wide) ---------------- */}
            <section
                style={{
                    marginTop: 16,
                    background: "#141414",
                    border: "1px solid #262626",
                    borderRadius: 10,
                    padding: 12,
                }}
            >
                <div style={{ fontWeight: 700, marginBottom: 8 }}>System-wide File Sync</div>

                {gNotice && (
                    <div style={{ background: "#102418", border: "1px solid #214d2c", padding: 10, borderRadius: 8, marginBottom: 8 }}>
                        {gNotice}
                    </div>
                )}
                {gErr && (
                    <div style={{ background: "#3b0f12", border: "1px solid #5b1a1f", padding: 10, borderRadius: 8, color: "#ffd7d7", marginBottom: 8 }}>
                        {gErr}
                    </div>
                )}

                <button type="button" onClick={() => void doGlobalSync()} style={primaryBtn} disabled={gBusy}>
                    {gBusy ? "Starting…" : "Sync All Files"}
                </button>
                <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
                    Triggers a full scan/sync of files for all games on the server.
                </div>
            </section>
        </div>
    );
}
