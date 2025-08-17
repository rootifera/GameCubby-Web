"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import LocationTreePicker from "@/components/LocationTreePicker";

/* ---------- types & tiny fetch helper ---------- */
type LocationNode = {
    id: number;
    name: string;
    parent_id: number | null;
    type?: string | null;
};

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, { cache: "no-store", ...init });
    const text = await res.text();
    if (!res.ok) {
        throw new Error(`${res.status} ${res.statusText}${text ? `: ${text.slice(0, 200)}` : ""}`);
    }
    return (text ? JSON.parse(text) : {}) as T;
}

/* ---------- component ---------- */
export default function LocationManager() {
    // Observe selection from LocationTreePicker via its hidden input
    const pickerHostRef = useRef<HTMLDivElement | null>(null);
    const [selectedId, setSelectedId] = useState<number | undefined>(undefined);
    const [selected, setSelected] = useState<LocationNode | null>(null);
    const [children, setChildren] = useState<LocationNode[] | null>(null);
    const [parentName, setParentName] = useState<string>("—"); // NEW: show parent name

    // force-remount the tree after mutating operations
    const [treeKey, setTreeKey] = useState(0);

    // status banners
    const [busy, setBusy] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [err, setErr] = useState<string | null>(null);

    // add form
    const [newName, setNewName] = useState("");
    const [newType, setNewType] = useState("");

    // rename form
    const [renameVal, setRenameVal] = useState("");

    // wire up hidden input changes from the picker
    useEffect(() => {
        const host = pickerHostRef.current;
        if (!host) return;
        const input = host.querySelector('input[name="location_id"]') as HTMLInputElement | null;
        if (!input) return;

        const update = () => {
            const v = input.value.trim();
            const n = Number(v);
            setSelectedId(Number.isFinite(n) && n > 0 ? n : undefined);
        };
        update();

        input.addEventListener("input", update);
        input.addEventListener("change", update);
        const mo = new MutationObserver(update);
        mo.observe(input, { attributes: true, attributeFilter: ["value"] });

        return () => {
            input.removeEventListener("input", update);
            input.removeEventListener("change", update);
            mo.disconnect();
        };
    }, [pickerHostRef.current, treeKey]);

    // load details for selected node (and its children list)
    useEffect(() => {
        let cancelled = false;
        if (!selectedId) {
            setSelected(null);
            setChildren(null);
            setRenameVal("");
            setParentName("—"); // reset parent name
            return;
        }

        (async () => {
            try {
                setBusy("Loading location…");
                setErr(null);
                setNotice(null);
                const [node, kids] = await Promise.all([
                    fetchJSON<LocationNode>(`/api/proxy/locations/${selectedId}?_=${Date.now()}`),
                    fetchJSON<LocationNode[]>(`/api/proxy/locations/children/${selectedId}?_=${Date.now()}`),
                ]);
                if (cancelled) return;
                setSelected(node);
                setChildren(kids ?? []);
                setRenameVal(node?.name ?? "");

                // NEW: resolve parent name if any
                if (node?.parent_id != null) {
                    try {
                        const parent = await fetchJSON<LocationNode>(`/api/proxy/locations/${node.parent_id}?_=${Date.now()}`);
                        if (!cancelled) setParentName(parent?.name ?? "—");
                    } catch {
                        if (!cancelled) setParentName("—");
                    }
                } else {
                    setParentName("—");
                }
            } catch (e: any) {
                if (!cancelled) {
                    setErr(e?.message ?? "Failed to load location");
                    setSelected(null);
                    setChildren(null);
                    setRenameVal("");
                    setParentName("—");
                }
            } finally {
                if (!cancelled) setBusy(null);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [selectedId]);

    /* ---------- actions ---------- */

    async function addLocation(e: React.FormEvent) {
        e.preventDefault();
        const name = newName.trim();
        if (!name) {
            setErr("Please enter a location name.");
            return;
        }
        setBusy("Adding location…");
        setErr(null);
        setNotice(null);
        try {
            const sp = new URLSearchParams();
            sp.set("name", name);
            if (selectedId) sp.set("parent_id", String(selectedId));
            if (newType.trim()) sp.set("type", newType.trim());

            // secured proxy (expects admin cookie)
            await fetchJSON<LocationNode>(`/api/admin/locations?${sp.toString()}`, {
                method: "POST",
            });

            setNotice(`Added “${name}” ${selectedId ? "under the selected node" : "at top level"}.`);
            setNewName("");
            setNewType("");

            // refresh tree (keep current selection if parent was selected)
            setTreeKey((k) => k + 1);
        } catch (e: any) {
            setErr(e?.message ?? "Add location failed");
        } finally {
            setBusy(null);
        }
    }

    async function renameSelected(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedId) return;
        const next = renameVal.trim();
        if (!next) {
            setErr("Please enter a new name.");
            return;
        }
        setBusy("Renaming…");
        setErr(null);
        setNotice(null);
        try {
            await fetchJSON<LocationNode>(`/api/admin/locations/${selectedId}/rename`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: next }),
            });
            setNotice("Location renamed.");
            // refresh tree and keep selection
            setTreeKey((k) => k + 1);
        } catch (e: any) {
            setErr(e?.message ?? "Rename failed");
        } finally {
            setBusy(null);
        }
    }

    async function deleteSelected() {
        if (!selectedId) return;
        if (!confirm("Delete this location? If it has children or is in use, the API may reject the request.")) {
            return;
        }
        setBusy("Deleting…");
        setErr(null);
        setNotice(null);
        try {
            const res = await fetch(`/api/admin/locations/${selectedId}`, {
                method: "DELETE",
                cache: "no-store",
            });
            if (!res.ok) {
                const text = await res.text().catch(() => "");
                // BETTER message: try to surface { detail } if present
                let friendly = `Delete failed (${res.status})`;
                try {
                    const obj = text ? JSON.parse(text) as any : null;
                    if (obj && typeof obj.detail === "string") {
                        friendly = obj.detail;
                    }
                } catch {
                    // ignore parse errors; fall back to default
                }
                throw new Error(friendly);
            }
            setNotice("Location deleted.");
            // clear selection and rebuild tree
            setSelectedId(undefined);
            setSelected(null);
            setChildren(null);
            setRenameVal("");
            setParentName("—");
            setTreeKey((k) => k + 1);
        } catch (e: any) {
            setErr(e?.message ?? "Delete failed");
        } finally {
            setBusy(null);
        }
    }

    /* ---------- styles ---------- */
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

    /* ---------- render ---------- */
    return (
        <div style={{ display: "grid", gap: 14 }}>
            {(busy || notice || err) && (
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

            <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 420px) 1fr", gap: 16 }}>
                {/* Left: tree */}
                <div
                    ref={pickerHostRef}
                    style={{
                        background: "#141414",
                        border: "1px solid #262626",
                        borderRadius: 10,
                        padding: 12,
                    }}
                >
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>Locations</div>
                    {/* force remount via key after mutations to re-hydrate */}
                    <div key={treeKey}>
                        <LocationTreePicker
                            label="Pick a location"
                            name="location_id"
                            defaultSelectedId={selectedId}
                            height={360}
                        />
                    </div>
                </div>

                {/* Right: details & actions */}
                <div style={{ display: "grid", gap: 12 }}>
                    {/* Selected details */}
                    <section
                        style={{
                            background: "#141414",
                            border: "1px solid #262626",
                            borderRadius: 10,
                            padding: 12,
                        }}
                    >
                        <div style={{ fontWeight: 700, marginBottom: 8 }}>Selected</div>
                        {!selectedId ? (
                            <div style={{ opacity: 0.75 }}>No location selected.</div>
                        ) : !selected ? (
                            <div style={{ opacity: 0.8 }}>Loading…</div>
                        ) : (
                            <div style={{ display: "grid", gap: 6 }}>
                                <div>
                                    <div style={{ opacity: 0.8, fontSize: 12 }}>Name</div>
                                    <div style={{ fontWeight: 600 }}>{selected.name}</div>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                    <div>
                                        <div style={{ opacity: 0.8, fontSize: 12 }}>ID</div>
                                        <div>{selected.id}</div>
                                    </div>
                                    <div>
                                        {/* CHANGED: Parent Name instead of Parent ID */}
                                        <div style={{ opacity: 0.8, fontSize: 12 }}>Parent Name</div>
                                        <div>{parentName}</div>
                                    </div>
                                </div>
                                <div>
                                    <div style={{ opacity: 0.8, fontSize: 12 }}>Type</div>
                                    <div>{selected.type ?? "—"}</div>
                                </div>
                                <div>
                                    <div style={{ opacity: 0.8, fontSize: 12 }}>Children</div>
                                    <div style={{ opacity: 0.9 }}>
                                        {children && children.length
                                            ? children.map((c) => c.name).join(", ")
                                            : "No direct children"}
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>

                    {/* Rename */}
                    <section
                        style={{
                            background: "#141414",
                            border: "1px solid #262626",
                            borderRadius: 10,
                            padding: 12,
                        }}
                    >
                        <div style={{ fontWeight: 700, marginBottom: 8 }}>Rename</div>
                        <form onSubmit={renameSelected} style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr auto" }}>
                            <input
                                value={renameVal}
                                onChange={(e) => setRenameVal(e.target.value)}
                                style={input}
                                placeholder="New name…"
                                disabled={!selectedId}
                            />
                            <button type="submit" style={primaryBtn} disabled={!selectedId}>
                                Save
                            </button>
                        </form>
                    </section>

                    {/* Add new (under selected or top level) */}
                    <section
                        style={{
                            background: "#141414",
                            border: "1px solid #262626",
                            borderRadius: 10,
                            padding: 12,
                        }}
                    >
                        <div style={{ fontWeight: 700, marginBottom: 8 }}>Add Location</div>
                        <form onSubmit={addLocation} style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr auto" }}>
                            <input
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                style={input}
                                placeholder={`Name (added ${selectedId ? "under selected" : "at top level"})`}
                            />
                            <input
                                value={newType}
                                onChange={(e) => setNewType(e.target.value)}
                                style={input}
                                placeholder="Type (optional)"
                            />
                            <button type="submit" style={primaryBtn}>
                                Add
                            </button>
                        </form>
                    </section>

                    {/* Delete */}
                    <section
                        style={{
                            background: "#141414",
                            border: "1px solid #262626",
                            borderRadius: 10,
                            padding: 12,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        <div>
                            <div style={{ fontWeight: 700 }}>Delete Location</div>
                            <div style={{ fontSize: 12, opacity: 0.8 }}>
                                Deletes the selected location. If the location has children or is in use, the API may reject the delete.
                            </div>
                        </div>
                        <button type="button" style={dangerBtn} onClick={() => void deleteSelected()} disabled={!selectedId}>
                            Delete
                        </button>
                    </section>
                </div>
            </div>
        </div>
    );
}
