"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
    /** Field name to submit under (Advanced uses "name", Basic keeps "q") */
    name?: string;
    /** Initial value */
    defaultValue?: string;

    /**
     * If set to a path (e.g. "/search"), the component will navigate to
     * `${onSelectNavigateTo}?<name>=value` on submit or when a suggestion is chosen.
     * If null, it will NOT navigate (useful for Advanced where parent form handles submit).
     *
     * Default: "/search"  (Basic behavior)
     */
    onSelectNavigateTo?: string | null;

    /**
     * Wrap the input in its own <form>. Basic = true (POSTs to /search),
     * Advanced = false (parent form controls submission).
     *
     * Default: true
     */
    wrapWithForm?: boolean;

    /** Placeholder text */
    placeholder?: string;
};

export default function SearchBox({
                                      name = "q",
                                      defaultValue = "",
                                      onSelectNavigateTo = "/search",
                                      wrapWithForm = true,
                                      placeholder = "Search games…",
                                  }: Props) {
    const [q, setQ] = useState(defaultValue);
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<string[]>([]);
    const [highlight, setHighlight] = useState(-1);
    const abortRef = useRef<AbortController | null>(null);
    const wrapRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

    // Fetch suggestions for any length >= 2
    useEffect(() => {
        // Skip if search is disabled
        if (searchDisabled) {
            return;
        }

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
        }, 1000);

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

    function navigateTo(path: string, value: string) {
        const u = new URL(path, window.location.origin);
        u.searchParams.set(name, value);
        window.location.href = u.toString();
    }

    function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        if (!q.trim()) {
            e.preventDefault();
            return;
        }
        if (onSelectNavigateTo) {
            // basic behavior: navigate to /search?<name>=q
            e.preventDefault();
            navigateTo(onSelectNavigateTo, q.trim());
            setQ("");
        }
        // else: advanced mode, let parent form submit naturally
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
                const chosen = items[highlight].trim();
                setQ(chosen);
                setOpen(false);
                // Don't navigate automatically - just fill the input field
                // User needs to manually submit the form
                inputRef.current?.focus();
            }
        } else if (e.key === "Escape") {
            setOpen(false);
        }
    }

    function choose(nameVal: string) {
        const chosen = nameVal.trim();
        setQ(chosen);
        setOpen(false);
        // Don't navigate automatically - just fill the input field
        // User needs to manually submit the form
        inputRef.current?.focus();
    }

    const InputEl = (
        <>
            {/* keep a real input bound to the parent form name */}
            <input
                ref={inputRef}
                name={name}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
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
                    {items.map((nameOpt, idx) => {
                        const active = idx === highlight;
                        return (
                            <li key={`${nameOpt}-${idx}`}>
                                <button
                                    type="button"
                                    onMouseEnter={() => setHighlight(idx)}
                                    onMouseLeave={() => setHighlight(-1)}
                                    onClick={() => choose(nameOpt)}
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
                                    {nameOpt}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            ) : null}
        </>
    );

    return (
        <div ref={wrapRef} style={{ position: "relative" }}>
            {wrapWithForm ? (
                <form action={onSelectNavigateTo ?? undefined} method="GET" onSubmit={onSubmit}>
                    {InputEl}
                </form>
            ) : (
                InputEl
            )}
        </div>
    );
}
