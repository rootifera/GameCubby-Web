"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
    defaultValue?: string;
};

export default function SearchBox({ defaultValue = "" }: Props) {
    const [q, setQ] = useState(defaultValue);
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<string[]>([]);
    const [highlight, setHighlight] = useState(-1);
    const abortRef = useRef<AbortController | null>(null);
    const wrapRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

    // Fetch suggestions for any length >= 2
    useEffect(() => {
        const value = q.trim();
        setHighlight(-1);

        // Close + clear when too short
        if (value.length < 2) {
            setItems([]);
            setOpen(false);
            // cancel any in-flight
            if (abortRef.current) abortRef.current.abort();
            return;
        }

        // debounce a touch
        const t = setTimeout(async () => {
            try {
                if (abortRef.current) abortRef.current.abort();
                const ac = new AbortController();
                abortRef.current = ac;

                const res = await fetch(`/api/suggest/names?q=${encodeURIComponent(value)}`, {
                    cache: "no-store",
                    signal: ac.signal,
                });

                if (!res.ok) {
                    setItems([]);
                    setOpen(false);
                    return;
                }

                const arr = (await res.json()) as string[]; // API returns array of names
                setItems(Array.isArray(arr) ? arr.slice(0, 10) : []);
                setOpen(true);
            } catch {
                // ignore aborted/failed fetch
            }
        }, 150);

        return () => clearTimeout(t);
    }, [q]);

    // Click outside to close
    useEffect(() => {
        function onDocClick(e: MouseEvent) {
            if (!wrapRef.current) return;
            if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, []);

    function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        if (!q.trim()) {
            e.preventDefault();
        }
    }

    function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (!open || items.length === 0) return;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => (h + 1) % items.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => (h - 1 + items.length) % items.length);
        } else if (e.key === "Enter") {
            if (highlight >= 0 && highlight < items.length) {
                e.preventDefault();
                const chosen = items[highlight];
                // navigate to /search?q=<chosen>
                window.location.href = `/search?q=${encodeURIComponent(chosen)}`;
            }
        } else if (e.key === "Escape") {
            setOpen(false);
        }
    }

    function choose(name: string) {
        // fill input and navigate
        setQ(name);
        window.location.href = `/search?q=${encodeURIComponent(name)}`;
    }

    return (
        <div ref={wrapRef} style={{ position: "relative" }}>
            <form action="/search" method="GET" onSubmit={onSubmit}>
                <input
                    ref={inputRef}
                    name="q"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Search games…"
                    autoComplete="off"
                    style={{
                        width: "100%",
                        background: "#1a1a1a",
                        color: "#eaeaea",
                        border: "1px solid #2b2b2b",
                        borderRadius: 8,
                        padding: "10px 12px",
                        outline: "none",
                    }}
                />
            </form>

            {open && items.length > 0 ? (
                <ul
                    style={{
                        position: "absolute",
                        zIndex: 20,
                        top: "100%",
                        left: 0,
                        right: 0,
                        marginTop: 6,
                        background: "#0f0f0f",
                        border: "1px solid #2b2b2b",
                        borderRadius: 8,
                        listStyle: "none",
                        padding: 6,
                        maxHeight: 260,
                        overflowY: "auto",
                    }}
                >
                    {items.map((name, idx) => {
                        const active = idx === highlight;
                        return (
                            <li key={`${name}-${idx}`}>
                                <button
                                    type="button"
                                    onMouseEnter={() => setHighlight(idx)}
                                    onMouseLeave={() => setHighlight(-1)}
                                    onClick={() => choose(name)}
                                    style={{
                                        display: "block",
                                        width: "100%",
                                        textAlign: "left",
                                        border: "none",
                                        background: active ? "#1e293b" : "transparent",
                                        color: active ? "#fff" : "#eaeaea",
                                        borderRadius: 6,
                                        padding: "8px 10px",
                                        cursor: "pointer",
                                    }}
                                >
                                    {name}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            ) : null}
        </div>
    );
}
