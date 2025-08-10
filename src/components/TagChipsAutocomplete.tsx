"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Item = { id: number | string; name: string };

export default function TagChipsAutocomplete({
                                                 label,
                                                 name,
                                                 suggestKind, // "tags" | "igdb_tags"
                                                 defaultSelectedIds = []
                                             }: {
    label: string;
    name: string;
    suggestKind: "tags" | "igdb_tags";
    defaultSelectedIds?: Array<number | string>;
}) {
    const [value, setValue] = useState("");
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<Item[]>([]);
    const [selected, setSelected] = useState<Item[]>([]);
    const [highlight, setHighlight] = useState(-1);

    const boxRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    // Load names for default IDs (for "tags" we can resolve from /tags/; for igdb tags we fall back to showing the ID)
    useEffect(() => {
        async function hydrate() {
            if (!defaultSelectedIds.length) return;
            if (suggestKind === "tags") {
                try {
                    const res = await fetch(`/api/tags/all`, { cache: "no-store" });
                    // We don't have this route, so fallback directly to the API via server proxy idea is not available here.
                    // Instead, hit the upstream list from the client is risky (CORS). We'll do a client-call to our own suggest endpoint with each name chunk.
                    // Simpler: just try once to fetch from /tags/ through a server proxy: we don't have one.
                } catch {
                    /* ignore */
                }
            }
            // Minimal, reliable approach: just render any known IDs as {id, name:id as string},
            // real names will appear as soon as user interacts with suggestions.
            setSelected(
                defaultSelectedIds.map((id) => ({
                    id,
                    name: String(id)
                }))
            );
        }
        hydrate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Close on outside click
    useEffect(() => {
        function onDocMouseDown(e: MouseEvent) {
            if (!boxRef.current) return;
            if (!boxRef.current.contains(e.target as Node)) {
                setOpen(false);
                setHighlight(-1);
            }
        }
        document.addEventListener("mousedown", onDocMouseDown);
        return () => document.removeEventListener("mousedown", onDocMouseDown);
    }, []);

    // Debounced suggestions (ask for full objects)
    useEffect(() => {
        const q = value.trim();
        if (!q) {
            setItems([]);
            setOpen(false);
            setHighlight(-1);
            return;
        }
        const t = setTimeout(async () => {
            if (abortRef.current) abortRef.current.abort();
            const controller = new AbortController();
            abortRef.current = controller;

            try {
                const res = await fetch(
                    `/api/suggest/${encodeURIComponent(suggestKind)}?q=${encodeURIComponent(q)}&full=1`,
                    { cache: "no-store", signal: controller.signal }
                );
                if (!res.ok) throw new Error("bad status");
                const data = (await res.json()) as Item[] | unknown;
                const arr: Item[] = Array.isArray(data)
                    ? data
                        .map((x: any) => ({ id: x?.id, name: x?.name }))
                        .filter((x) => (typeof x.id === "number" || typeof x.id === "string") && typeof x.name === "string")
                    : [];
                setItems(arr);
                setOpen(arr.length > 0);
                setHighlight(-1);
            } catch {
                setItems([]);
                setOpen(false);
                setHighlight(-1);
            }
        }, 200);
        return () => clearTimeout(t);
    }, [value, suggestKind]);

    const hiddenValue = useMemo(() => selected.map((s) => String(s.id)).join(","), [selected]);

    function addItem(it: Item) {
        setSelected((prev) => {
            if (prev.some((p) => String(p.id) === String(it.id))) return prev;
            return [...prev, it];
        });
        setValue("");
        setItems([]);
        setOpen(false);
        setHighlight(-1);
        inputRef.current?.focus();
    }

    function removeItem(id: string | number) {
        setSelected((prev) => prev.filter((p) => String(p.id) !== String(id)));
    }

    function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Backspace" && !value && selected.length) {
            e.preventDefault();
            removeItem(selected[selected.length - 1].id);
            return;
        }
        if (!open || !items.length) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => (h + 1) % items.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => (h <= 0 ? items.length - 1 : h - 1));
        } else if (e.key === "Enter") {
            if (highlight >= 0 && highlight < items.length) {
                e.preventDefault();
                addItem(items[highlight]);
            }
        } else if (e.key === "Escape") {
            setOpen(false);
            setHighlight(-1);
        }
    }

    return (
        <div ref={boxRef} style={{ display: "grid", gap: 6, position: "relative" }}>
            <label style={{ opacity: 0.85 }}>{label}</label>
            {/* Hidden input with CSV of IDs for GET submit */}
            <input type="hidden" name={name} value={hiddenValue} />

            {/* Chip input */}
            <div
                style={{
                    minHeight: 44,
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 6,
                    background: "#1a1a1a",
                    color: "#eaeaea",
                    border: "1px solid #2b2b2b",
                    borderRadius: 8,
                    padding: "6px 8px"
                }}
                onClick={() => inputRef.current?.focus()}
            >
                {selected.map((s) => (
                    <span
                        key={`chip-${s.id}`}
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
            {s.name}
                        <span
                            role="button"
                            aria-label={`Remove ${s.name}`}
                            onClick={() => removeItem(s.id)}
                            style={{ fontWeight: 700, opacity: 0.7, cursor: "pointer", userSelect: "none" }}
                        >
              ×
            </span>
          </span>
                ))}
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onFocus={() => setOpen(items.length > 0)}
                    onKeyDown={onKeyDown}
                    placeholder={selected.length ? "" : "Type to add…"}
                    style={{
                        flex: 1,
                        minWidth: 140,
                        background: "transparent",
                        color: "#eaeaea",
                        border: "none",
                        outline: "none",
                        padding: "6px 8px"
                    }}
                />
            </div>

            {/* Suggestions */}
            {open && items.length > 0 && (
                <ul
                    role="listbox"
                    aria-label="Suggestions"
                    style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        marginTop: 4,
                        background: "#111",
                        border: "1px solid #262626",
                        borderRadius: 8,
                        listStyle: "none",
                        padding: 4,
                        zIndex: 50,
                        boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
                        maxHeight: 260,
                        overflowY: "auto"
                    }}
                >
                    {items.map((it, i) => {
                        const active = i === highlight;
                        return (
                            <li
                                key={`${it.id}-${i}`}
                                role="option"
                                aria-selected={active}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    addItem(it);
                                }}
                                onMouseEnter={() => setHighlight(i)}
                                style={{
                                    padding: "8px 10px",
                                    borderRadius: 6,
                                    cursor: "pointer",
                                    background: active ? "#1e293b" : "transparent",
                                    border: active ? "1px solid #3b82f6" : "1px solid transparent",
                                    color: "#eaeaea",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    gap: 12
                                }}
                            >
                                <span>{it.name}</span>
                                <span style={{ opacity: 0.6, fontSize: 12 }}>#{String(it.id)}</span>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
