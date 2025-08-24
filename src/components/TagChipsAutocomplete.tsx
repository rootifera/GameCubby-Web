"use client";

import { useEffect, useMemo, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";

type Chip = { id: number; name: string };
type SuggestKind = "tags" | "igdb_tags";

export interface TagChipsAutocompleteRef {
    addTag: (tagName: string) => void;
}

export default forwardRef<TagChipsAutocompleteRef, {
    label?: string;
    name?: string;
    suggestKind: SuggestKind;
    defaultSelectedIds?: Array<number | string>;
    searchOnly?: boolean;
    onTagsChange?: (tags: { existing: Chip[]; new: string[] }) => void;
}>(function TagChipsAutocomplete({
    label = "Tags",
    name = "tag_ids",               // e.g. "tag_ids" or "igdb_tag_ids"
    suggestKind,
    defaultSelectedIds = [],
    searchOnly = false,
    onTagsChange
}, ref) {
    // --- UI state
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [highlight, setHighlight] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Existing tags (from suggestions / ids) and NEW free-text tags
    const [options, setOptions] = useState<Chip[]>([]);
    const [selectedExisting, setSelectedExisting] = useState<Chip[]>([]);
    const [newNames, setNewNames] = useState<string[]>([]);

    const inputRef = useRef<HTMLInputElement | null>(null);
    const rootRef = useRef<HTMLDivElement | null>(null);

    // ---------- Clear when parent <form> .reset() is called ----------
    useEffect(() => {
        function onReset(ev: Event) {
            const form = ev.target as HTMLFormElement | null;
            if (!form || !rootRef.current) return;
            if (!form.contains(rootRef.current)) return;
            setSelectedExisting([]);
            setNewNames([]);
            setOptions([]);
            setQuery("");
            setOpen(false);
            setHighlight(0);
            setError(null);
        }
        document.addEventListener("reset", onReset, true);
        return () => document.removeEventListener("reset", onReset, true);
    }, []);

    // ---------- Rehydrate from IDs in defaultSelectedIds ----------
    useEffect(() => {
        const ids = (defaultSelectedIds ?? [])
            .flatMap((raw) => {
                if (typeof raw === "string" && raw.includes(",")) {
                    return raw.split(",").map((x) => x.trim());
                }
                return [raw];
            })
            .map((x) => Number(x))
            .filter((n) => Number.isFinite(n) && n > 0);

        if (!ids.length) return;

        let cancelled = false;
        (async () => {
            try {
                const base =
                    suggestKind === "igdb_tags" ? "/api/proxy/igdb/tags" : "/api/proxy/tags";
                const results = await Promise.all(
                    ids.map(async (id) => {
                        try {
                            const res = await fetch(`${base}/${id}`, { cache: "no-store" });
                            if (!res.ok) throw new Error();
                            const data = (await res.json()) as { id: number; name: string };
                            if (typeof data?.id === "number" && typeof data?.name === "string") {
                                return { id: data.id, name: data.name } as Chip;
                            }
                        } catch {
                            /* ignore */
                        }
                        return null;
                    })
                );
                const chips = results.filter(Boolean) as Chip[];
                if (!cancelled && chips.length) {
                    setSelectedExisting((prev) => mergeChipsReplace(prev, chips));
                }
            } catch {
                /* ignore */
            }
        })();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // mount once

    // ---------- Debounced suggestions ----------
    useEffect(() => {
        const q = query.trim();
        if (q.length < 2) {
            setOptions([]);
            setOpen(false);
            setError(null);
            setLoading(false);
            return;
        }
        const handle = setTimeout(async () => {
            setLoading(true);
            setError(null);
            try {
                const url = `/api/suggest/${encodeURIComponent(suggestKind)}?full=1&q=${encodeURIComponent(q)}`;
                const res = await fetch(url, { cache: "no-store" });
                if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
                const arr = (await res.json()) as Array<{ id: number | string; name: string }>;

                const mapped: Chip[] = [];
                for (const it of arr) {
                    const idNum = Number((it as any).id);
                    const nameStr = String((it as any).name || "");
                    if (Number.isFinite(idNum) && nameStr) mapped.push({ id: idNum, name: nameStr });
                }
                setOptions(mapped);
                setOpen(mapped.length > 0 || q.length >= 2); // keep open so we can show "Add “q”"
                setHighlight(0);
            } catch (e) {
                setError(e instanceof Error ? e.message : "Failed to fetch suggestions");
                setOptions([]);
                setOpen(false);
            } finally {
                setLoading(false);
            }
        }, 180);
        return () => clearTimeout(handle);
    }, [query, suggestKind]);

    // ---------- Helpers to check duplicates ----------
    const lowerSetExisting = useMemo(
        () => new Set(selectedExisting.map((c) => c.name.toLowerCase())),
        [selectedExisting]
    );
    const lowerSetNew = useMemo(
        () => new Set(newNames.map((n) => n.toLowerCase())),
        [newNames]
    );

    // Should we show the "Add “query”" row?
    const canCreateFromQuery = useMemo(() => {
        if (searchOnly) return false; // Disable tag creation in search mode
        const q = query.trim();
        if (q.length < 2) return false;
        const l = q.toLowerCase();
        if (lowerSetExisting.has(l) || lowerSetNew.has(l)) return false;
        // also hide if an option has the exact same name
        if (options.some((o) => o.name.toLowerCase() === l)) return false;
        return true;
    }, [query, lowerSetExisting, lowerSetNew, options, searchOnly]);

    // ---------- Select / remove ----------
    const onSelectExisting = useCallback((chip: Chip) => {
        if (!Number.isFinite(chip.id) || chip.id <= 0) return;
        setSelectedExisting((prev) => {
            if (prev.some((c) => c.id === chip.id)) return prev;
            return [...prev, chip];
        });
        
        // Add to recently used tags in localStorage
        try {
            const stored = localStorage.getItem('gamecubby_recent_tags');
            const recentTags = stored ? JSON.parse(stored) as string[] : [];
            const filtered = recentTags.filter(tag => tag.toLowerCase() !== chip.name.toLowerCase());
            const newRecentTags = [chip.name, ...filtered].slice(0, 5);
            localStorage.setItem('gamecubby_recent_tags', JSON.stringify(newRecentTags));
        } catch (error) {
            console.warn('Failed to update recent tags in localStorage:', error);
        }
        
        setQuery("");
        setOpen(false);
        setOptions([]);
        setHighlight(0);
        inputRef.current?.focus();
    }, []);

    const onCreateNew = useCallback((raw: string) => {
        if (searchOnly) return; // Disable tag creation in search mode
        const t = raw.trim();
        if (t.length < 2) return;
        const l = t.toLowerCase();
        if (lowerSetExisting.has(l) || lowerSetNew.has(l)) return;
        setNewNames((prev) => [...prev, t]);
        
        // Add to recently used tags in localStorage
        try {
            const stored = localStorage.getItem('gamecubby_recent_tags');
            const recentTags = stored ? JSON.parse(stored) as string[] : [];
            const filtered = recentTags.filter(tag => tag.toLowerCase() !== l);
            const newRecentTags = [t, ...filtered].slice(0, 5);
            localStorage.setItem('gamecubby_recent_tags', JSON.stringify(newRecentTags));
        } catch (error) {
            console.warn('Failed to update recent tags in localStorage:', error);
        }
        
        setQuery("");
        setOpen(false);
        setOptions([]);
        setHighlight(0);
        inputRef.current?.focus();
    }, [lowerSetExisting, lowerSetNew, searchOnly]);

    const onRemoveExisting = useCallback((id: number) => {
        setSelectedExisting((prev) => prev.filter((c) => c.id !== id));
    }, []);
    const onRemoveNew = useCallback((name: string) => {
        setNewNames((prev) => prev.filter((n) => n !== name));
    }, []);

    // Function to programmatically add a tag
    const addTag = useCallback((tagName: string) => {
        const trimmed = tagName.trim();
        if (trimmed.length < 2) return;
        
        const l = trimmed.toLowerCase();
        if (lowerSetExisting.has(l) || lowerSetNew.has(l)) return;
        
        setNewNames((prev) => [...prev, trimmed]);
        
        // Add to recently used tags in localStorage
        try {
            const stored = localStorage.getItem('gamecubby_recent_tags');
            const recentTags = stored ? JSON.parse(stored) as string[] : [];
            const filtered = recentTags.filter(tag => tag.toLowerCase() !== l);
            const newRecentTags = [trimmed, ...filtered].slice(0, 5);
            localStorage.setItem('gamecubby_recent_tags', JSON.stringify(newRecentTags));
        } catch (error) {
            console.warn('Failed to update recent tags in localStorage:', error);
        }
    }, [lowerSetExisting, lowerSetNew]);

    // Expose addTag function to parent component
    useEffect(() => {
        if (onTagsChange) {
            onTagsChange({ existing: selectedExisting, new: newNames });
        }
    }, [selectedExisting, newNames, onTagsChange]);

    // Expose addTag function via ref
    useImperativeHandle(ref, () => ({
        addTag
    }), [addTag]);

    // ---------- Hidden input values ----------
    const csvIds = useMemo(
        () => selectedExisting.map((c) => c.id).join(","),
        [selectedExisting]
    );
    const mixedJson = useMemo(() => {
        const mixed = [...selectedExisting.map((c) => c.id as number | string), ...(searchOnly ? [] : newNames)];
        try {
            return JSON.stringify(mixed);
        } catch {
            return "[]";
        }
    }, [selectedExisting, newNames, searchOnly]);

    // ---------- Keyboard ----------
    function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        const hasOpts = options.length > 0 || canCreateFromQuery;
        if (!open || !hasOpts) return;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            const listLen = options.length + (canCreateFromQuery ? 1 : 0);
            setHighlight((h) => Math.min(h + 1, listLen - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
        } else if (e.key === "Enter") {
            e.preventDefault();
            const createRowIndex = 0; // we place "Add" at the top when shown
            if (canCreateFromQuery && highlight === createRowIndex) {
                onCreateNew(query);
            } else {
                const idx = highlight - (canCreateFromQuery ? 1 : 0);
                if (idx >= 0 && idx < options.length) onSelectExisting(options[idx]);
            }
        } else if (e.key === "Escape") {
            setOpen(false);
        } else if (e.key === "," /* quick add on comma */) {
            if (searchOnly) return; // Disable tag creation in search mode
            const q = query.trim();
            if (q.length >= 2 && canCreateFromQuery) {
                e.preventDefault();
                onCreateNew(q);
            }
        }
    }

    // ---------- Render ----------
    return (
        <div ref={rootRef} style={{ display: "grid", gap: 6, position: "relative" }}>
            <label style={{ opacity: 0.85 }}>{label}</label>

            {/* Back-compat numeric IDs CSV */}
            <input type="hidden" name={name} value={csvIds} />
            {/* New: mixed array (numbers + strings) JSON, e.g. tag_ids_mix */}
            <input type="hidden" name={`${name}_mix`} value={mixedJson} />

            <div style={boxStyle}>
                {/* Chips (existing + new) */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {selectedExisting.map((c) => (
                        <span key={`id-${c.id}`} style={chipStyle} title={`${c.name}`}>
              {c.name}
                            <button
                                type="button"
                                onClick={() => onRemoveExisting(c.id)}
                                style={chipXBtn}
                                aria-label={`Remove ${c.name}`}
                            >
                ×
              </button>
            </span>
                    ))}
                    {!searchOnly && newNames.map((n) => (
                        <span
                            key={`new-${n}`}
                            style={{ ...chipStyle, background: "#234232", borderColor: "#2e7d32", color: "#d1fadf" }}
                            title={`${n} (new)`}
                        >
              {n}
                            <button
                                type="button"
                                onClick={() => onRemoveNew(n)}
                                style={chipXBtn}
                                aria-label={`Remove ${n}`}
                            >
                ×
              </button>
            </span>
                    ))}
                </div>

                {/* Input */}
                <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setOpen(true)}
                    onKeyDown={onKeyDown}
                    placeholder={searchOnly ? "Type to search…" : "Type to add…"}
                    autoComplete="off"
                    style={inputStyle}
                />
            </div>

            {/* Dropdown */}
            {open && (options.length > 0 || canCreateFromQuery) ? (
                <ul style={menuStyle} role="listbox">
                    {canCreateFromQuery ? (
                        <li
                            key="__create__"
                            style={{
                                ...menuItemStyle,
                                fontStyle: "italic",
                                background: highlight === 0 ? "#263043" : "transparent",
                            }}
                            onMouseEnter={() => setHighlight(0)}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                onCreateNew(query);
                            }}
                        >
                            Add “{query.trim()}”
                        </li>
                    ) : null}

                    {options.map((opt, idx) => {
                        const offset = canCreateFromQuery ? 1 : 0;
                        const hi = highlight === idx + offset;
                        const isSel =
                            selectedExisting.some((s) => s.id === opt.id) ||
                            newNames.some((n) => n.toLowerCase() === opt.name.toLowerCase());
                        return (
                            <li
                                key={`${opt.id}-${idx}`}
                                style={{
                                    ...menuItemStyle,
                                    background: hi ? "#263043" : "transparent",
                                    opacity: isSel ? 0.5 : 1,
                                    cursor: isSel ? "not-allowed" : "pointer",
                                }}
                                onMouseEnter={() => setHighlight(idx + offset)}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    if (!isSel) onSelectExisting(opt);
                                }}
                            >
                                {opt.name}
                                <span style={{ opacity: 0.6, marginLeft: 8, fontSize: 11 }}>#{opt.id}</span>
                            </li>
                        );
                    })}
                </ul>
            ) : null}

            {loading ? <div style={{ fontSize: 12, opacity: 0.7 }}>Loading…</div> : null}
            {error ? <div style={{ color: "#fca5a5", fontSize: 12 }}>{error}</div> : null}
        </div>
    );
});

/* ---------- utils ---------- */
function mergeChipsReplace(prev: Chip[], next: Chip[]): Chip[] {
    const byId = new Map<number, Chip>();
    for (const p of prev) byId.set(p.id, p);
    for (const n of next) byId.set(n.id, n);
    return Array.from(byId.values());
}

/* ---------- styles ---------- */
const boxStyle: React.CSSProperties = {
    background: "#1a1a1a",
    border: "1px solid #2b2b2b",
    borderRadius: 8,
    padding: 8,
    minHeight: 90,
    display: "grid",
    alignItems: "center",
};

const inputStyle: React.CSSProperties = {
    background: "transparent",
    color: "#eaeaea",
    border: "none",
    outline: "none",
    padding: "8px 10px",
    width: "100%",
    minHeight: "36px",
};

const chipStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "#263043",
    color: "#dbeafe",
    border: "1px solid #3b82f6",
    borderRadius: 999,
    padding: "4px 8px",
    fontSize: 12,
};

const chipXBtn: React.CSSProperties = {
    background: "transparent",
    color: "inherit",
    border: "none",
    cursor: "pointer",
    fontSize: 14,
    lineHeight: 1,
};

const menuStyle: React.CSSProperties = {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    background: "#0f0f0f",
    border: "1px solid #2b2b2b",
    borderRadius: 8,
    margin: "6px 0 0 0",
    padding: 6,
    listStyle: "none",
    maxHeight: 260,
    overflowY: "auto",
    zIndex: 30,
};

const menuItemStyle: React.CSSProperties = {
    padding: "8px 10px",
    borderRadius: 6,
};
