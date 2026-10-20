"use client";

import React, { useEffect, useMemo, useState } from "react";
import LocationTreePicker from "@/components/LocationTreePicker";

/* ---------- types & tiny fetch helper ---------- */
type LocationNode = {
    id: number;
    name: string;
    parent_id: number | null;
    type?: string | null;
};

type OrderChange = { game_id: number; name: string; old: number; new: number };
type OrderTie = { order: number; games: { game_id: number; name: string; new: number }[] };
type OrderLocationPlan = { location_id: number; path: string[]; games: number; changed: number; changes: OrderChange[]; ties: OrderTie[] };
type GapsPlan = { applied: boolean; fingerprint: string; locations: OrderLocationPlan[]; total_games: number; total_changed: number };

type OrderGameRef = { game_id: number; name: string; order: number };
type OrderGap = { start: number; end: number; count: number; after: OrderGameRef | null; before: OrderGameRef | null };
type OrderDup = { order: number; games: OrderGameRef[] };
type OrderProblem = {
    location_id: number; path: string[]; games: number; starts_at: number | null;
    gaps: OrderGap[]; duplicates: OrderDup[]; fixable_changes: number;
};
type OrderReport = {
    locations_checked: number; games_checked: number; locations_ok: number;
    with_gaps: number; with_duplicates: number; not_starting_at_1: number; problem_locations: OrderProblem[];
};

const gapText = (g: OrderGap) => (g.count === 1 ? `#${g.start}` : `#${g.start}–#${g.end} (${g.count} numbers)`);
const gameText = (r: OrderGameRef | null) => (r ? `${r.name} (#${r.order})` : "—");

function csvCell(v: string | number): string {
    const t = String(v);
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

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

    // fill order gaps
    const [includeKids, setIncludeKids] = useState(false);
    const [gapsPlan, setGapsPlan] = useState<GapsPlan | null>(null);
    const [gapsBusy, setGapsBusy] = useState(false);

    // find gaps: a read-only report over ALL locations
    const [report, setReport] = useState<OrderReport | null>(null);
    const [reportBusy, setReportBusy] = useState(false);
    const [justSelected, setJustSelected] = useState<number | null>(null);

    // a preview belongs to one location + one scope: drop it as soon as either changes
    useEffect(() => {
        setGapsPlan(null);
    }, [selectedId, includeKids]);

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

            setNotice(`Added "${name}" ${selectedId ? "under the selected node" : "at top level"}.`);
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

    /** Preview (apply=false) or apply (apply=true, with the preview's fingerprint) the renumbering. */
    async function runFillGaps(apply: boolean) {
        if (!selectedId) return;
        setGapsBusy(true);
        setErr(null);
        setNotice(null);
        try {
            const res = await fetch(`/api/admin/locations/${selectedId}/fill-gaps`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                cache: "no-store",
                body: JSON.stringify({
                    include_children: includeKids,
                    apply,
                    fingerprint: apply ? gapsPlan?.fingerprint : undefined,
                }),
            });
            const text = await res.text();
            let data: any = null;
            try {
                data = text ? JSON.parse(text) : null;
            } catch {
                /* not JSON */
            }
            if (!res.ok) {
                throw new Error(typeof data?.detail === "string" ? data.detail : `Request failed (${res.status})`);
            }
            if (apply) {
                const locs = (data as GapsPlan).locations.filter((l) => l.changed > 0).length;
                setNotice(
                    `Renumbered ${data.total_changed} game${data.total_changed === 1 ? "" : "s"} in ${locs} location${locs === 1 ? "" : "s"}. ` +
                    "Their order numbers now run 1, 2, 3… with no gaps."
                );
                setGapsPlan(null);
            } else {
                setGapsPlan(data as GapsPlan);
            }
        } catch (e: any) {
            setErr(e?.message ?? "Fill gaps failed");
            if (apply) setGapsPlan(null); // the preview is no longer trustworthy: preview again
        } finally {
            setGapsBusy(false);
        }
    }

    async function runFindGaps() {
        setReportBusy(true);
        setErr(null);
        setNotice(null);
        setJustSelected(null);
        try {
            setReport(await fetchJSON<OrderReport>("/api/admin/locations/order-report"));
        } catch (e: any) {
            setErr(e?.message ?? "Find gaps failed");
            setReport(null);
        } finally {
            setReportBusy(false);
        }
    }

    /** Jump to a problem location in the tree so it can be previewed/fixed with the buttons above. */
    function selectProblemLocation(id: number) {
        setSelectedId(id);
        setTreeKey((k) => k + 1);
        setJustSelected(id);
    }

    function downloadReportCsv() {
        if (!report) return;
        const rows = [["location", "location_id", "issue", "detail", "games"]];
        for (const p of report.problem_locations) {
            const where = p.path.join(" > ");
            if (p.starts_at) rows.push([where, String(p.location_id), "does not start at 1", `first game is #${p.starts_at}`, ""]);
            for (const g of p.gaps) rows.push([where, String(p.location_id), "gap", `missing ${gapText(g)}`, `${gameText(g.after)} | ${gameText(g.before)}`]);
            for (const d of p.duplicates) rows.push([where, String(p.location_id), "duplicate", `#${d.order} used by ${d.games.length} games`, d.games.map(gameText).join(" | ")]);
        }
        const blob = new Blob([rows.map((r) => r.map(csvCell).join(",")).join("\n")], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "order-gaps-report.csv";
        a.click();
        URL.revokeObjectURL(url);
    }

    function downloadGapsCsv() {
        if (!gapsPlan) return;
        const rows = [["location", "game_id", "game", "old_order", "new_order"]];
        for (const loc of gapsPlan.locations) {
            for (const c of loc.changes) rows.push([loc.path.join(" > "), String(c.game_id), c.name, String(c.old), String(c.new)]);
        }
        const blob = new Blob([rows.map((r) => r.map(csvCell).join(",")).join("\n")], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `order-changes-${(selected?.name ?? "location").replace(/[^a-z0-9]+/gi, "_")}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /* ---------- styles ---------- */
    const input = {
        background: "var(--gc-surface)",
        color: "var(--gc-text)",
        border: "1px solid var(--gc-border)",
        borderRadius: 8,
        padding: "8px 10px",
        outline: "none",
    } as const;

    const btn: React.CSSProperties = {
        display: "inline-block",
        background: "var(--gc-field)",
        color: "var(--gc-text)",
        border: "1px solid var(--gc-border)",
        borderRadius: 8,
        padding: "8px 12px",
        textDecoration: "none",
        whiteSpace: "nowrap",
        cursor: "pointer",
    };

    const primaryBtn: React.CSSProperties = {
        ...btn,
        background: "var(--gc-accent-soft)",
        border: "1px solid var(--gc-accent)",
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
        <div style={{ display: "grid", gap: 16 }}>
            {/* Status banners */}
            {(busy || notice || err) && (
                <div style={{ display: "grid", gap: 8 }}>
                    {busy && (
                        <div style={{ background: "var(--gc-field)", border: "1px solid var(--gc-border)", padding: 10, borderRadius: 8 }}>
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

            {/* Top: Locations card (full width) */}
            <div
                style={{
                    background: "var(--gc-surface-raised)",
                    border: "1px solid var(--gc-border)",
                    borderRadius: 10,
                    padding: 16,
                }}
            >
                <div style={{ fontWeight: 700, marginBottom: 12, fontSize: "16px" }}>Locations</div>
                {/* force remount via key after mutations to re-hydrate */}
                <div key={treeKey}>
                    <LocationTreePicker
                        label="Pick a location"
                        name="location_id"
                        defaultSelectedId={selectedId}
                        onSelectedIdChange={setSelectedId}
                        height={400}
                    />
                </div>
            </div>

            {/* Below: Action cards (full width, stacked vertically) */}
            <div style={{ display: "grid", gap: 16 }}>
                {/* Selected Location Details */}
                <section
                    style={{
                        background: "var(--gc-surface-raised)",
                        border: "1px solid var(--gc-border)",
                        borderRadius: 10,
                        padding: 16,
                    }}
                >
                    <div style={{ fontWeight: 700, marginBottom: 12, fontSize: "16px" }}>Selected Location Details</div>
                    {!selectedId ? (
                        <div style={{ opacity: 0.75 }}>No location selected.</div>
                    ) : !selected ? (
                        <div style={{ opacity: 0.8 }}>Loading…</div>
                    ) : (
                        <div style={{ display: "grid", gap: 12 }}>
                            <div>
                                <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 4 }}>Name</div>
                                <div style={{ fontWeight: 600, fontSize: "14px" }}>{selected.name}</div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                                <div>
                                    <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 4 }}>ID</div>
                                    <div style={{ fontSize: "14px" }}>{selected.id}</div>
                                </div>
                                <div>
                                    <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 4 }}>Parent Name</div>
                                    <div style={{ fontSize: "14px" }}>{parentName}</div>
                                </div>
                            </div>
                            <div>
                                <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 4 }}>Type</div>
                                <div style={{ fontSize: "14px" }}>{selected.type ?? "—"}</div>
                            </div>
                            <div>
                                <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 4 }}>Children</div>
                                {children && children.length > 0 ? (
                                    <div style={{ 
                                        background: "#0f0f0f", 
                                        border: "1px solid #333", 
                                        borderRadius: 6, 
                                        padding: 8,
                                        maxHeight: 120,
                                        overflow: "auto"
                                    }}>
                                        <div style={{ display: "grid", gap: 4 }}>
                                            {children.map((child) => (
                                                <div 
                                                    key={child.id}
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 8,
                                                        padding: "4px 6px",
                                                        background: "var(--gc-field)",
                                                        borderRadius: 4,
                                                        fontSize: "13px"
                                                    }}
                                                >
                                                    <span style={{ opacity: 0.7 }}>▶</span>
                                                    <span style={{ fontWeight: 500 }}>{child.name}</span>
                                                    {child.type && (
                                                        <span style={{ 
                                                            opacity: 0.6, 
                                                            fontSize: "11px",
                                                            background: "#333",
                                                            padding: "2px 6px",
                                                            borderRadius: 3
                                                        }}>
                                                            {child.type}
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ opacity: 0.9, fontSize: "14px", fontStyle: "italic" }}>
                                        No direct children
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </section>

                {/* Add Location */}
                <section
                    style={{
                        background: "var(--gc-surface-raised)",
                        border: "1px solid var(--gc-border)",
                        borderRadius: 10,
                        padding: 16,
                    }}
                >
                    <div style={{ fontWeight: 700, marginBottom: 12, fontSize: "16px" }}>Add Location</div>
                    <form onSubmit={addLocation} style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr auto" }}>
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

                {/* Rename */}
                <section
                    style={{
                        background: "var(--gc-surface-raised)",
                        border: "1px solid var(--gc-border)",
                        borderRadius: 10,
                        padding: 16,
                    }}
                >
                    <div style={{ fontWeight: 700, marginBottom: 12, fontSize: "16px" }}>Rename</div>
                    <form onSubmit={renameSelected} style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr auto" }}>
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

                {/* Fill order gaps */}
                <section
                    style={{
                        background: "var(--gc-surface-raised)",
                        border: "1px solid var(--gc-border)",
                        borderRadius: 10,
                        padding: 16,
                    }}
                >
                    <div style={{ fontWeight: 700, marginBottom: 6, fontSize: "16px" }}>Fill order gaps</div>
                    <div style={{ fontSize: 12, opacity: 0.8, lineHeight: "1.5", marginBottom: 12 }}>
                        Renumbers the games in the selected location so their order runs 1, 2, 3… with no gaps or
                        duplicates, for example after games were taken off the shelf. Every location is numbered on its own.
                        You&apos;ll see a preview first; nothing changes until you apply.
                    </div>
                    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
                            <input
                                type="checkbox"
                                checked={includeKids}
                                onChange={(e) => setIncludeKids(e.target.checked)}
                                disabled={!selectedId || gapsBusy}
                            />
                            Include all sub-locations (each one is numbered separately)
                        </label>
                        <button
                            type="button"
                            style={primaryBtn}
                            onClick={() => void runFillGaps(false)}
                            disabled={!selectedId || gapsBusy}
                        >
                            {gapsBusy && !gapsPlan ? "Checking…" : "Preview"}
                        </button>
                        <button
                            type="button"
                            style={btn}
                            onClick={() => void runFindGaps()}
                            disabled={reportBusy}
                            title="Read-only: lists the gaps, duplicates and shelves not starting at 1 in ALL locations"
                        >
                            {reportBusy ? "Searching…" : "Find gaps (all locations)"}
                        </button>
                    </div>

                    {report && (
                        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                                <div style={{ fontWeight: 700 }}>Gap report — all locations</div>
                                <button type="button" style={{ ...btn, padding: "4px 8px", fontSize: 12 }} onClick={() => setReport(null)}>
                                    Close report
                                </button>
                            </div>
                            {report.problem_locations.length === 0 ? (
                                <div style={{ background: "#102418", border: "1px solid #214d2c", padding: 10, borderRadius: 8 }}>
                                    No gaps, duplicates or wrong starting numbers: all {report.locations_checked} locations ({report.games_checked} games) are numbered 1…N.
                                </div>
                            ) : (
                                <>
                                    <div style={{ fontSize: 14, lineHeight: "1.5" }}>
                                        Checked <strong>{report.locations_checked}</strong> locations ({report.games_checked} games):{" "}
                                        <strong>{report.problem_locations.length}</strong> need attention —{" "}
                                        {report.with_gaps} with gaps, {report.with_duplicates} with duplicate numbers, {report.not_starting_at_1} not
                                        starting at 1. The other {report.locations_ok} are fine.
                                    </div>
                                    <div style={{ display: "grid", gap: 6, maxHeight: 420, overflow: "auto" }}>
                                        {report.problem_locations.map((p) => (
                                            <div key={p.location_id} style={{ background: "var(--gc-field)", border: "1px solid var(--gc-border)", borderRadius: 8, padding: "8px 10px" }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                                    <div style={{ fontSize: 14 }}>
                                                        <strong>{p.path.join(" › ")}</strong>{" "}
                                                        <span style={{ opacity: 0.7 }}>({p.games} games)</span>
                                                    </div>
                                                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                                        {justSelected === p.location_id && (
                                                            <span style={{ fontSize: 12, color: "#9ae6b4" }}>selected — click Preview above</span>
                                                        )}
                                                        <button type="button" style={{ ...btn, padding: "4px 8px", fontSize: 12 }} onClick={() => selectProblemLocation(p.location_id)}>
                                                            Select in tree
                                                        </button>
                                                    </div>
                                                </div>
                                                <ul style={{ margin: "6px 0 0 18px", padding: 0, fontSize: 13, lineHeight: "1.55" }}>
                                                    {p.starts_at != null && <li>Doesn&apos;t start at 1: the first game is <strong>#{p.starts_at}</strong>.</li>}
                                                    {p.gaps.map((g) => (
                                                        <li key={`g${g.start}`}>
                                                            Missing <strong>{gapText(g)}</strong> — between {gameText(g.after)} and {gameText(g.before)}
                                                        </li>
                                                    ))}
                                                    {p.duplicates.map((d) => (
                                                        <li key={`d${d.order}`}>
                                                            <strong>#{d.order}</strong> is used by {d.games.map((x) => x.name).join(" and ")}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                    <div>
                                        <button type="button" style={btn} onClick={downloadReportCsv}>
                                            Download report (CSV)
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {gapsPlan && (
                        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                            {gapsPlan.total_games === 0 ? (
                                <div style={{ opacity: 0.85 }}>No games with an order number in {includeKids ? "this location or its sub-locations" : "this location"}.</div>
                            ) : gapsPlan.total_changed === 0 ? (
                                <div style={{ background: "#102418", border: "1px solid #214d2c", padding: 10, borderRadius: 8 }}>
                                    Nothing to change: all {gapsPlan.total_games} games are already numbered 1…N with no gaps.
                                </div>
                            ) : (
                                <>
                                    <div style={{ fontWeight: 600 }}>
                                        {gapsPlan.total_changed} of {gapsPlan.total_games} games would change, in{" "}
                                        {gapsPlan.locations.filter((l) => l.changed > 0).length} of {gapsPlan.locations.length} location
                                        {gapsPlan.locations.length === 1 ? "" : "s"}.
                                    </div>

                                    {gapsPlan.locations.filter((l) => l.ties.length > 0).length > 0 && (
                                        <div style={{ background: "#2b2410", border: "1px solid #6b5a1f", padding: 10, borderRadius: 8, fontSize: 13, lineHeight: "1.5" }}>
                                            <strong>Some games share a number.</strong> Each game needs its own place, so they are split in the
                                            order they were added to the library. Please check these on the shelf:
                                            <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                                                {gapsPlan.locations.flatMap((l) =>
                                                    l.ties.map((t) => (
                                                        <li key={`${l.location_id}-${t.order}`}>
                                                            {l.path.join(" › ")}: both had #{t.order} →{" "}
                                                            {t.games.map((g) => `${g.name} (#${g.new})`).join(", ")}
                                                        </li>
                                                    ))
                                                )}
                                            </ul>
                                        </div>
                                    )}

                                    <div style={{ display: "grid", gap: 6, maxHeight: 360, overflow: "auto" }}>
                                        {gapsPlan.locations.filter((l) => l.changed > 0).map((l) => (
                                            <details key={l.location_id} open={gapsPlan.locations.length <= 3} style={{ background: "var(--gc-field)", border: "1px solid var(--gc-border)", borderRadius: 8, padding: "6px 10px" }}>
                                                <summary style={{ cursor: "pointer", fontSize: 14 }}>
                                                    <strong>{l.path.join(" › ")}</strong> — {l.changed} of {l.games} change
                                                </summary>
                                                <div style={{ display: "grid", gap: 3, marginTop: 6, fontSize: 13 }}>
                                                    {l.changes.map((c) => (
                                                        <div key={c.game_id} style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 8 }}>
                                                            <span style={{ opacity: 0.85, fontVariantNumeric: "tabular-nums" }}>#{c.old} → #{c.new}</span>
                                                            <span>{c.name}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </details>
                                        ))}
                                    </div>

                                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                        <button type="button" style={primaryBtn} onClick={() => void runFillGaps(true)} disabled={gapsBusy}>
                                            {gapsBusy ? "Applying…" : `Apply ${gapsPlan.total_changed} change${gapsPlan.total_changed === 1 ? "" : "s"}`}
                                        </button>
                                        <button type="button" style={btn} onClick={downloadGapsCsv} disabled={gapsBusy}>
                                            Download changes (CSV)
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </section>

                {/* Delete */}
                <section
                    style={{
                        background: "var(--gc-surface-raised)",
                        border: "1px solid var(--gc-border)",
                        borderRadius: 10,
                        padding: 16,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                    }}
                >
                    <div>
                        <div style={{ fontWeight: 700, fontSize: "16px", marginBottom: 4 }}>Delete Location</div>
                        <div style={{ fontSize: 12, opacity: 0.8, lineHeight: "1.4" }}>
                            Deletes the selected location. If the location has children or is in use, the API will reject the delete.
                        </div>
                    </div>
                    <button type="button" style={dangerBtn} onClick={() => void deleteSelected()} disabled={!selectedId}>
                        Delete
                    </button>
                </section>
            </div>
        </div>
    );
}
