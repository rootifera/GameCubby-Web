"use client";

import { useEffect, useMemo, useState, useRef } from "react";

/** API payload shape */
type LocationNode = {
    id: number;
    name: string;
    parent_id: number | null;
    type?: string | null;
};

type Props = {
    label?: string;
    /** Hidden input name used by GET form submission */
    name?: string;
    /** Optional pre-selected node id to hydrate/expand to */
    defaultSelectedId?: number;
    /** Optional fixed height for the tree panel */
    height?: number;
};

/** Small fetch helper against our proxy routes */
async function fetchJSON<T>(url: string): Promise<T> {
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}${text ? `: ${text.slice(0, 200)}` : ""}`);
    return (text ? JSON.parse(text) : {}) as T;
}

export default function LocationTreePicker({
                                               label = "Location",
                                               name = "location_id",
                                               defaultSelectedId,
                                               height = 260
                                           }: Props) {
    // Map parentId -> children
    const [childrenMap, setChildrenMap] = useState<Map<number | null, LocationNode[]>>(new Map());
    // Which nodes are expanded
    const [expanded, setExpanded] = useState<Set<number>>(new Set());
    // Currently selected node id (leaf or any)
    const [selectedId, setSelectedId] = useState<number | undefined>(undefined);
    // Loading/error states per parent id
    const [loadingParents, setLoadingParents] = useState<Set<number | null>>(new Set());
    const [error, setError] = useState<string | null>(null);
    
    // Ref for auto-scrolling
    const treeContainerRef = useRef<HTMLDivElement>(null);

    // Load top level on mount
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setLoadingParents((s) => new Set(s).add(null));
                const top = await fetchJSON<LocationNode[]>("/api/proxy/locations/top");
                if (cancelled) return;
                setChildrenMap((m) => {
                    const mm = new Map(m);
                    mm.set(null, top || []);
                    return mm;
                });
            } catch (e) {
                if (!cancelled) setError(errMsg(e));
            } finally {
                if (!cancelled) {
                    setLoadingParents((s) => {
                        const ss = new Set(s);
                        ss.delete(null);
                        return ss;
                    });
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    // Hydrate a pre-selected node path (expand ancestors, load siblings)
    useEffect(() => {
        if (!defaultSelectedId) return;
        let cancelled = false;

        (async () => {
            try {
                // Build chain root->...->selected
                const chain: LocationNode[] = [];
                let current: number | null = defaultSelectedId;
                while (current != null) {
                    const node: LocationNode = await fetchJSON<LocationNode>(`/api/proxy/locations/${current}`);
                    chain.push(node);
                    current = node.parent_id ?? null;
                }
                chain.reverse();

                // Ensure children are loaded and expand along the chain
                let parentId: number | null = null;
                for (const n of chain) {
                    await ensureChildren(parentId);
                    setExpanded((old) => {
                        const next = new Set(old);
                        next.add(n.id);
                        return next;
                    });
                    parentId = n.id;
                }
                setSelectedId(defaultSelectedId);
                setError(null);
            } catch (e) {
                if (!cancelled) setError(errMsg(e));
            }
        })();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [defaultSelectedId]);

    /** Ensure children for given parent id are loaded into the map */
    async function ensureChildren(parentId: number | null) {
        if (childrenMap.has(parentId)) return;
        setLoadingParents((s) => new Set(s).add(parentId));
        try {
            const children = await fetchJSON<LocationNode[]>(
                parentId == null ? `/api/proxy/locations/top` : `/api/proxy/locations/children/${parentId}`
            );
            setChildrenMap((m) => {
                const mm = new Map(m);
                mm.set(parentId, children || []);
                return mm;
            });
        } finally {
            setLoadingParents((s) => {
                const ss = new Set(s);
                ss.delete(parentId);
                return ss;
            });
        }
    }

    function toggleExpand(id: number) {
        setExpanded((old) => {
            const n = new Set(old);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
        });
    }

    function onSelect(id: number) {
        setSelectedId(id);
    }

    function onClear() {
        setSelectedId(undefined);
    }

    // Auto-scroll to newly expanded nodes
    const scrollToNode = (nodeId: number) => {
        setTimeout(() => {
            if (treeContainerRef.current) {
                const nodeElement = treeContainerRef.current.querySelector(`[data-node-id="${nodeId}"]`);
                if (nodeElement) {
                    nodeElement.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'nearest',
                        inline: 'nearest'
                    });
                }
            }
        }, 100); // Small delay to ensure DOM is updated
    };

    // Build breadcrumb for selectedId
    const breadcrumb = useMemo(() => {
        if (!selectedId) return "";
        const trail: string[] = [];
        const findNode = (id: number): LocationNode | undefined => {
            for (const arr of childrenMap.values()) {
                const hit = arr?.find((n) => n.id === id);
                if (hit) return hit;
            }
            return undefined;
        };
        let node = findNode(selectedId);
        if (!node) return "";
        trail.unshift(node.name);
        let pid = node.parent_id;
        let guard = 0;
        while (pid != null && guard++ < 20) {
            const parent = findNode(pid);
            if (!parent) break;
            trail.unshift(parent.name);
            pid = parent.parent_id;
        }
        return trail.join(" > ");
    }, [selectedId, childrenMap]);

    return (
        <div style={{ display: "grid", gap: 8 }}>
            <label style={{ opacity: 0.85, wordWrap: "break-word", overflowWrap: "break-word" }}>{label}</label>

            {/* hidden input for form GET submit */}
            <input type="hidden" name={name} value={selectedId ?? ""} />

            {/* breadcrumb + clear */}
            <div style={crumbBarStyle}>
                <div style={crumbTextWrapStyle} title={breadcrumb}>
                    <span style={{ opacity: 0.9, wordWrap: "break-word", overflowWrap: "break-word" }}>
                        {breadcrumb || "No location selected"}
                    </span>
                </div>
                {selectedId ? (
                    <button type="button" onClick={onClear} style={btnSecondary} title="Clear selection">
                        Clear
                    </button>
                ) : null}
            </div>

            {/* Tree panel */}
            <div
                ref={treeContainerRef}
                style={{
                    background: "#141414",
                    border: "1px solid #2b2b2b",
                    borderRadius: 8,
                    padding: 6,
                    maxHeight: height,
                    overflow: "auto"
                }}
            >
                {error ? (
                    <div style={{ color: "#fca5a5", fontSize: 12 }}>{error}</div>
                ) : (
                    <TreeLevel
                        parentId={null}
                        childrenMap={childrenMap}
                        expanded={expanded}
                        loadingParents={loadingParents}
                        ensureChildren={ensureChildren}
                        toggleExpand={toggleExpand}
                        onSelect={onSelect}
                        selectedId={selectedId}
                        depth={0}
                        scrollToNode={scrollToNode}
                    />
                )}
            </div>
        </div>
    );
}

/* ---------------- Tree rendering ---------------- */

function TreeLevel(props: {
    parentId: number | null;
    childrenMap: Map<number | null, LocationNode[]>;
    expanded: Set<number>;
    loadingParents: Set<number | null>;
    ensureChildren: (parentId: number | null) => Promise<void>;
    toggleExpand: (id: number) => void;
    onSelect: (id: number) => void;
    selectedId?: number;
    depth: number;
    scrollToNode: (nodeId: number) => void;
}) {
    const {
        parentId,
        childrenMap,
        expanded,
        loadingParents,
        ensureChildren,
        toggleExpand,
        onSelect,
        selectedId,
        depth,
        scrollToNode
    } = props;

    const children = childrenMap.get(parentId);

    useEffect(() => {
        // lazy load this level if not present
        if (!children && !loadingParents.has(parentId)) {
            void ensureChildren(parentId);
        }
    }, [children, loadingParents, parentId, ensureChildren]);

    if (loadingParents.has(parentId) && !children) {
        return <div style={{ padding: "6px 8px", opacity: 0.7 }}>Loading…</div>;
    }

    if (!children || children.length === 0) {
        if (parentId === null) {
            return <div style={{ padding: "6px 8px", opacity: 0.7 }}>No locations</div>;
        }
        return null;
    }

    return (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {children.map((node) => {
                const isExpanded = expanded.has(node.id);
                const isSelected = selectedId === node.id;

                return (
                    <li key={node.id} style={{ margin: 0 }}>
                        <div
                            data-node-id={node.id}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "4px 6px",
                                marginLeft: depth * 14,
                                borderRadius: 6,
                                background: isSelected ? "#1e293b" : "transparent",
                                border: isSelected ? "1px solid #334155" : "1px solid transparent"
                            }}
                        >
                            {/* expand/collapse toggle */}
                            <button
                                type="button"
                                aria-label={isExpanded ? "Collapse" : "Expand"}
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    if (!isExpanded) {
                                        await ensureChildren(node.id);
                                        // Auto-scroll to newly expanded node
                                        scrollToNode(node.id);
                                    }
                                    toggleExpand(node.id);
                                }}
                                style={chevronBtn}
                                title={isExpanded ? "Collapse" : "Expand"}
                            >
                                {isExpanded ? "▾" : "▸"}
                            </button>

                            {/* select radio */}
                            <input
                                type="radio"
                                name="__loc_radio"
                                checked={isSelected}
                                onChange={() => onSelect(node.id)}
                                style={{ cursor: "pointer" }}
                                aria-label={`Select ${node.name}`}
                            />

                            {/* node label */}
                            <button
                                type="button"
                                onClick={() => onSelect(node.id)}
                                style={{
                                    ...nodeBtn,
                                    fontWeight: isSelected ? 600 : 500
                                }}
                                title={node.name}
                            >
                                {node.name}
                            </button>
                        </div>

                        {/* children */}
                        {isExpanded ? (
                            <TreeLevel
                                parentId={node.id}
                                childrenMap={childrenMap}
                                expanded={expanded}
                                loadingParents={loadingParents}
                                ensureChildren={ensureChildren}
                                toggleExpand={toggleExpand}
                                onSelect={onSelect}
                                selectedId={selectedId}
                                depth={depth + 1}
                                scrollToNode={scrollToNode}
                            />
                        ) : null}
                    </li>
                );
            })}
        </ul>
    );
}

/* ---------------- utils & styles ---------------- */

function errMsg(e: unknown): string {
    if (e instanceof Error) return e.message;
    try {
        return JSON.stringify(e);
    } catch {
        return String(e);
    }
}

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
    wordWrap: "break-word",
    overflowWrap: "break-word"
};

const chevronBtn: React.CSSProperties = {
    background: "transparent",
    color: "#eaeaea",
    border: "1px solid #2b2b2b",
    borderRadius: 6,
    width: 24,
    height: 24,
    lineHeight: "20px",
    textAlign: "center" as const,
    cursor: "pointer",
    padding: 0
};

const nodeBtn: React.CSSProperties = {
    background: "transparent",
    color: "#eaeaea",
    border: "none",
    padding: "2px 4px",
    cursor: "pointer",
    textAlign: "left" as const,
    flex: 1
};
