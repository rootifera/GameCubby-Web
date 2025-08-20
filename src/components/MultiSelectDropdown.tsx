"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type Option = { id: number | string; name: string };

type Props = {
    /** Visible label above the control */
    label: string;
    /** Form field name written to a hidden input
     *  - multiple=true  -> comma-separated IDs: "1,2,3"
     *  - multiple=false -> single ID or empty string
     */
    name: string;
    /** Options to pick from */
    options: Option[];
    /** Preselected IDs (numbers or strings) */
    defaultSelectedIds?: Array<number | string>;
    /** Allow multiple selection (default: true) */
    multiple?: boolean;
    /** Placeholder text when nothing is selected */
    placeholder?: string;
    /** Optional: compact size (shorter input height) */
    compact?: boolean;
};

export default function MultiSelectDropdown({
                                                label,
                                                name,
                                                options,
                                                defaultSelectedIds = [],
                                                multiple = true,
                                                placeholder = "Select…",
                                                compact = false
                                            }: Props) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [selected, setSelected] = useState<Set<string>>(
        () => new Set(defaultSelectedIds.map(String))
    );

    const rootRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

    // close dropdown on outside click
    useEffect(() => {
        function onDocMouseDown(e: MouseEvent) {
            if (!rootRef.current) return;
            if (!rootRef.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", onDocMouseDown);
        return () => document.removeEventListener("mousedown", onDocMouseDown);
    }, []);

    // compute filtered list
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return options;
        return options
            .filter((o) => o.name.toLowerCase().includes(q))
            .sort((a, b) => {
                const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
                const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
                if (aStarts !== bStarts) return aStarts - bStarts;
                return a.name.localeCompare(b.name);
            });
    }, [options, query]);

    // the string written to the hidden input
    const formValue = useMemo(() => {
        const vals = Array.from(selected);
        return multiple ? vals.join(",") : (vals[0] ?? "");
    }, [selected, multiple]);

    function toggle(id: string) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (multiple) {
                if (next.has(id)) next.delete(id);
                else next.add(id);
            } else {
                next.clear();
                next.add(id);
                setOpen(false);
            }
            return next;
        });
    }

    function removeChip(id: string) {
        setSelected((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    }

    const selectedOptions = useMemo(
        () => options.filter((o) => selected.has(String(o.id))),
        [options, selected]
    );

    const height = compact ? 36 : 44;

    return (
        <div ref={rootRef} style={{ display: "grid", gap: 6, position: "relative" }}>
            <label style={{ opacity: 0.85 }}>{label}</label>

            {/* Hidden input that actually carries the value in the GET request */}
            <input ref={inputRef} type="hidden" name={name} value={formValue} />

            {/* Control */}
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                style={{
                    minHeight: height,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    background: "#1a1a1a",
                    color: "#eaeaea",
                    border: "1px solid #2b2b2b",
                    borderRadius: 8,
                    padding: "8px 10px",
                    cursor: "pointer",
                    textAlign: "left"
                }}
            >
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {selectedOptions.length === 0 ? (
                        <span style={{ opacity: 0.6 }}>{placeholder}</span>
                    ) : (
                        selectedOptions.map((o) => (
                            <span
                                key={`chip-${o.id}`}
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 6,
                                    background: "#1e1e1e",
                                    border: "1px solid #2b2b2b",
                                    borderRadius: 999,
                                    padding: "4px 8px",
                                    fontSize: 12
                                }}
                            >
                {o.name}
                                <span
                                    role="button"
                                    aria-label={`Remove ${o.name}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeChip(String(o.id));
                                    }}
                                    style={{
                                        fontWeight: 700,
                                        opacity: 0.7,
                                        cursor: "pointer",
                                        userSelect: "none"
                                    }}
                                >
                  ×
                </span>
              </span>
                        ))
                    )}
                </div>
                <span aria-hidden style={{ opacity: 0.7 }}>▾</span>
            </button>

            {/* Dropdown */}
            {open && (
                <div
                    style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        marginTop: 4,
                        background: "#111",
                        border: "1px solid #262626",
                        borderRadius: 8,
                        padding: 8,
                        zIndex: 50,
                        boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
                        maxWidth: "100%",
                        overflow: "hidden"
                    }}
                >
                    <input
                        type="text"
                        placeholder="Filter…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        autoFocus
                        style={{
                            width: "100%",
                            maxWidth: "100%",
                            boxSizing: "border-box" as const,
                            background: "#1a1a1a",
                            color: "#eaeaea",
                            border: "1px solid #2b2b2b",
                            borderRadius: 8,
                            padding: "8px 10px",
                            outline: "none",
                            marginBottom: 8
                        }}
                    />

                    <div
                        style={{
                            maxHeight: 240,
                            overflowY: "auto",
                            display: "grid",
                            gap: 4
                        }}
                    >
                        {filtered.length === 0 ? (
                            <div style={{ opacity: 0.7, padding: 8 }}>No options.</div>
                        ) : (
                            filtered.map((o) => {
                                const id = String(o.id);
                                const checked = selected.has(id);
                                return (
                                    <label
                                        key={`opt-${id}`}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                            padding: "6px 8px",
                                            borderRadius: 6,
                                            background: checked ? "#1e293b" : "transparent",
                                            border: checked ? "1px solid #3b82f6" : "1px solid transparent",
                                            cursor: "pointer"
                                        }}
                                        onMouseDown={(e) => {
                                            // prevent focus loss on the filter box
                                            e.preventDefault();
                                        }}
                                    >
                                        <input
                                            type={multiple ? "checkbox" : "radio"}
                                            checked={checked}
                                            onChange={() => toggle(id)}
                                            style={{ accentColor: "#3b82f6" }}
                                        />
                                        <span>{o.name}</span>
                                    </label>
                                );
                            })
                        )}
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                        <button
                            type="button"
                            onClick={() => {
                                setSelected(new Set());
                                setQuery("");
                            }}
                            style={btnGhost}
                        >
                            Clear
                        </button>
                        <button type="button" onClick={() => setOpen(false)} style={btnPrimary}>
                            Done
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

const btnPrimary: React.CSSProperties = {
    background: "#1e293b",
    color: "#fff",
    border: "1px solid #3b82f6",
    borderRadius: 8,
    padding: "8px 12px",
    fontWeight: 600,
    cursor: "pointer"
};

const btnGhost: React.CSSProperties = {
    background: "#151515",
    color: "#eaeaea",
    border: "1px solid #2b2b2b",
    borderRadius: 8,
    padding: "8px 12px",
    cursor: "pointer"
};
