"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type SuggestItem = { id?: number; name?: string } | string;

export default function SearchBox({ defaultValue = "" }: { defaultValue?: string }) {
    const [value, setValue] = useState(defaultValue);
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<string[]>([]);
    const [highlight, setHighlight] = useState<number>(-1);

    const formRef = useRef<HTMLFormElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const boxRef = useRef<HTMLDivElement | null>(null);

    // Close the dropdown if user clicks outside
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

    // Debounced suggestions
    useEffect(() => {
        if (!value.trim()) {
            setItems([]);
            setOpen(false);
            setHighlight(-1);
            return;
        }

        const t = setTimeout(async () => {
            // cancel previous request if still running
            if (abortRef.current) abortRef.current.abort();
            const controller = new AbortController();
            abortRef.current = controller;

            try {
                const res = await fetch(`/api/suggest/names?q=${encodeURIComponent(value.trim())}`, {
                    cache: "no-store",
                    signal: controller.signal
                });
                if (!res.ok) throw new Error("bad status");
                const data = (await res.json()) as SuggestItem[] | unknown;

                // Normalize into an array of strings
                const names = (Array.isArray(data) ? data : [])
                    .map((x) => (typeof x === "string" ? x : (x as any)?.name))
                    .filter((s: unknown): s is string => typeof s === "string" && s.length > 0);

                setItems(names.slice(0, 8));
                setOpen(names.length > 0);
                setHighlight(-1);
            } catch {
                // swallow errors -> just hide suggestions
                setItems([]);
                setOpen(false);
                setHighlight(-1);
            }
        }, 200);

        return () => clearTimeout(t);
    }, [value]);

    function submitWith(val: string) {
        // Put chosen value into the input and submit the GET form to /search?q=...
        setValue(val);
        setOpen(false);
        setHighlight(-1);
        // Submit on next tick so state updates apply
        setTimeout(() => formRef.current?.submit(), 0);
    }

    function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (!open || items.length === 0) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => (h + 1) % items.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => (h <= 0 ? items.length - 1 : h - 1));
        } else if (e.key === "Enter") {
            if (highlight >= 0 && highlight < items.length) {
                e.preventDefault();
                submitWith(items[highlight]);
            }
        } else if (e.key === "Escape") {
            setOpen(false);
            setHighlight(-1);
        }
    }

    const dropdown = useMemo(() => {
        if (!open || items.length === 0) return null;
        return (
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
                    boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
                    maxHeight: 240,
                    overflowY: "auto"
                }}
            >
                {items.map((name, i) => {
                    const active = i === highlight;
                    return (
                        <li
                            key={`${name}-${i}`}
                            role="option"
                            aria-selected={active}
                            onMouseDown={(e) => {
                                // prevent input blur before we handle click
                                e.preventDefault();
                                submitWith(name);
                            }}
                            onMouseEnter={() => setHighlight(i)}
                            style={{
                                padding: "8px 10px",
                                borderRadius: 6,
                                cursor: "pointer",
                                background: active ? "#1e293b" : "transparent",
                                border: active ? "1px solid #3b82f6" : "1px solid transparent",
                                color: "#eaeaea"
                            }}
                        >
                            {name}
                        </li>
                    );
                })}
            </ul>
        );
    }, [open, items, highlight]);

    return (
        <div ref={boxRef} style={{ position: "relative", width: "100%" }}>
            <form ref={formRef} method="GET" action="/search" style={{ display: "flex", gap: 8 }}>
                <input
                    ref={inputRef}
                    type="text"
                    name="q"
                    value={value}
                    placeholder="Search games by name…"
                    autoComplete="off"
                    onChange={(e) => setValue(e.target.value)}
                    onFocus={() => setOpen(items.length > 0)}
                    onKeyDown={onKeyDown}
                    style={{
                        flex: 1,
                        background: "#1a1a1a",
                        color: "#eaeaea",
                        border: "1px solid #2b2b2b",
                        borderRadius: 8,
                        padding: "10px 12px",
                        outline: "none"
                    }}
                />
                <button
                    type="submit"
                    style={{
                        background: "#1e293b",
                        color: "#fff",
                        border: "1px solid #3b82f6",
                        borderRadius: 8,
                        padding: "10px 14px",
                        fontWeight: 600,
                        cursor: "pointer",
                        whiteSpace: "nowrap"
                    }}
                >
                    Search
                </button>
            </form>

            {/* dropdown */}
            {dropdown}
        </div>
    );
}
