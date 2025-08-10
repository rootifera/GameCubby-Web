"use client";

import { useEffect, useMemo, useState } from "react";

type LocationNode = {
    id: number;
    name: string;
    parent_id: number | null;
    type?: string | null;
};

type Level = {
    parentId: number | null;
    options: LocationNode[];
    selectedId: number | null;
};

export default function LocationPicker({
                                           label = "Location",
                                           name = "location_id",
                                           defaultSelectedId
                                       }: {
    label?: string;
    name?: string;
    defaultSelectedId?: number;
}) {
    const [levels, setLevels] = useState<Level[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // mount: load top-level via proxy
    useEffect(() => {
        let ignore = false;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const top = await fetchJSON<LocationNode[]>(`/api/proxy/locations/top`);
                if (ignore) return;
                setLevels([{ parentId: null, options: top ?? [], selectedId: null }]);
            } catch (e) {
                if (!ignore) setError(errMsg(e));
            } finally {
                if (!ignore) setLoading(false);
            }
        })();
        return () => {
            ignore = true;
        };
    }, []);

    // hydrate a preselected location path (optional)
    useEffect(() => {
        if (!defaultSelectedId) return;
        let cancelled = false;

        (async () => {
            try {
                const chain: LocationNode[] = [];
                let currentId: number | null = defaultSelectedId;

                while (currentId != null) {
                    const loc: LocationNode = await fetchJSON<LocationNode>(
                        `/api/proxy/locations/${currentId}`
                    );
                    chain.push(loc);
                    currentId = loc.parent_id ?? null;
                }
                chain.reverse();

                const newLevels: Level[] = [];
                const topOptions = await fetchJSON<LocationNode[]>(`/api/proxy/locations/top`);
                newLevels.push({
                    parentId: null,
                    options: topOptions ?? [],
                    selectedId: chain.length ? chain[0].id : null
                });

                for (let i = 0; i < chain.length; i++) {
                    const node = chain[i];
                    const children = await fetchJSON<LocationNode[]>(
                        `/api/proxy/locations/children/${node.id}`
                    );
                    if (!children || children.length === 0) continue;

                    const nextSelected = chain[i + 1]?.id ?? null;
                    newLevels.push({
                        parentId: node.id,
                        options: children,
                        selectedId: nextSelected
                    });
                }

                if (!cancelled) {
                    setLevels(newLevels);
                }
            } catch {
                // ignore hydration failures
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [defaultSelectedId]);

    const selectedTrail: LocationNode[] = useMemo(() => {
        const out: LocationNode[] = [];
        for (let i = 0; i < levels.length; i++) {
            const lvl = levels[i];
            if (!lvl.selectedId) break;
            const node = lvl.options.find((o) => o.id === lvl.selectedId);
            if (!node) break;
            out.push(node);
        }
        return out;
    }, [levels]);

    const leafId = selectedTrail.length ? selectedTrail[selectedTrail.length - 1].id : "";

    async function onSelect(levelIndex: number, newSelectedId: number) {
        try {
            setLevels((prev) => {
                const next = prev.slice(0, levelIndex + 1).map((lvl, i) =>
                    i === levelIndex ? { ...lvl, selectedId: newSelectedId } : lvl
                );
                return next;
            });

            const children = await fetchJSON<LocationNode[]>(
                `/api/proxy/locations/children/${newSelectedId}`
            );

            setLevels((prev) => {
                const base = prev.slice(0, levelIndex + 1);
                if (children && children.length) {
                    base.push({ parentId: newSelectedId, options: children, selectedId: null });
                }
                return base;
            });
        } catch (e) {
            setError(errMsg(e));
        }
    }

    function resetSelection() {
        setLevels((prev) => prev.map((lvl) => ({ ...lvl, selectedId: null })).slice(0, 1));
    }

    return (
        <div style={{ display: "grid", gap: 8 }}>
            <label style={{ opacity: 0.85 }}>{label}</label>
            {/* Hidden input for GET submit */}
            <input type="hidden" name={name} value={leafId} />

            {/* Breadcrumb bar */}
            <div style={crumbBarStyle}>
                <div style={crumbTextWrapStyle} title={selectedTrail.map((n) => n.name).join(" > ")}>
          <span style={{ opacity: 0.9 }}>
            {selectedTrail.length
                ? selectedTrail.map((n) => n.name).join(" > ")
                : loading
                    ? "Loading locations…"
                    : error
                        ? "Failed to load locations"
                        : "No location selected"}
          </span>
                </div>
                {selectedTrail.length ? (
                    <button
                        type="button"
                        onClick={resetSelection}
                        style={btnSecondary}
                        title="Clear selection"
                    >
                        Clear
                    </button>
                ) : null}
            </div>

            {/* Column selects */}
            {!error ? (
                <div style={columnsWrapStyle}>
                    {levels.map((lvl, idx) => (
                        <select
                            key={`level-${idx}-${lvl.parentId ?? "root"}`}
                            value={lvl.selectedId ?? ""}
                            onChange={(e) => onSelect(idx, Number(e.target.value))}
                            style={selectStyle}
                            onFocus={(e) => (e.currentTarget.style.borderColor = "#3b82f6")}
                            onBlur={(e) => (e.currentTarget.style.borderColor = "#2b2b2b")}
                        >
                            <option value="" disabled>
                                {idx === 0 ? "Select top…" : "Select…"}
                            </option>
                            {lvl.options.map((o) => (
                                <option key={o.id} value={o.id}>
                                    {o.name}
                                </option>
                            ))}
                        </select>
                    ))}
                    {loading ? <span style={{ opacity: 0.7 }}>Loading…</span> : null}
                </div>
            ) : (
                <div style={{ color: "#fca5a5", fontSize: 12, lineHeight: 1.4 }}>{error}</div>
            )}
        </div>
    );
}

/* helpers */

async function fetchJSON<T>(url: string): Promise<T> {
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}${text ? `: ${text.slice(0, 160)}` : ""}`);
    return (text ? JSON.parse(text) : {}) as T;
}

function errMsg(e: unknown): string {
    if (e instanceof Error) return e.message;
    try {
        return JSON.stringify(e);
    } catch {
        return String(e);
    }
}

/* styles */

const baseInput: React.CSSProperties = {
    background: "#1a1a1a",
    color: "#eaeaea",
    border: "1px solid #2b2b2b",
    borderRadius: 8,
    padding: "10px 12px",
    outline: "none",
    height: 42,            // consistent control height
    lineHeight: "22px"
};

const selectStyle: React.CSSProperties = {
    ...baseInput,
    minWidth: 180
};

const btnSecondary: React.CSSProperties = {
    background: "#1e1e1e",
    color: "#eaeaea",
    border: "1px solid #2b2b2b",
    borderRadius: 8,
    padding: "8px 12px",
    height: 36,
    cursor: "pointer"
};

const crumbBarStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "8px 10px",
    background: "#141414",
    border: "1px solid #2b2b2b",
    borderRadius: 8,
    minHeight: 44
};

const crumbTextWrapStyle: React.CSSProperties = {
    flex: 1,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
};

const columnsWrapStyle: React.CSSProperties = {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center"
};
