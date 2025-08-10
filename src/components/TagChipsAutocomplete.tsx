"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";

type Chip = { id: number; name: string };
type SuggestKind = "tags" | "igdb_tags";

export default function TagChipsAutocomplete({
                                                 label = "Tags",
                                                 name = "tag_ids",
                                                 suggestKind,
                                                 defaultSelectedIds = []
                                             }: {
    label?: string;
    name?: string; // hidden input name: "tag_ids" or "igdb_tag_ids"
    suggestKind: SuggestKind;
    defaultSelectedIds?: Array<number | string>;
}) {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [highlight, setHighlight] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [options, setOptions] = useState<Chip[]>([]);
    const [selected, setSelected] = useState<Chip[]>([]);

    const inputRef = useRef<HTMLInputElement | null>(null);
    const rootRef = useRef<HTMLDivElement | null>(null);

    /* ------------------------------------------------------
       Clear when the containing <form> is reset.
       Listen at document level (capture phase) so we never miss it.
    -------------------------------------------------------*/
    useEffect(() => {
        function onReset(ev: Event) {
            const form = ev.target as HTMLFormElement | null;
            if (!form || !rootRef.current) return;
            if (!form.contains(rootRef.current)) return; // not our form
            // Clear internal state so chips disappear and hidden input empties
            setSelected([]);
            setOptions([]);
            setQuery("");
            setOpen(false);
            setHighlight(0);
            setError(null);
        }
        document.addEventListener("reset", onReset, true);
        return () => document.removeEventListener("reset", onReset, true);
    }, []);

    /* ----------------------------------------------------------------
       Rehydrate from IDs found in the URL on first render
       - IGDB TAGS: /api/proxy/igdb/tags/{id}
       - TAGS:      /api/proxy/tags/{id}
    ------------------------------------------------------------------*/
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
                            // ignore this id
                        }
                        return null;
                    })
                );

                const chips = results.filter(Boolean) as Chip[];
                if (!cancelled && chips.length) {
                    setSelected((prev) => mergeChipsReplace(prev, chips));
                }
            } catch {
                // ignore
            }
        })();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // run once on mount

    /* ------------------------------------------------------
       Debounced suggestions via our proxy:
       /api/suggest/{tags|igdb_tags}?full=1&q=
    -------------------------------------------------------*/
    useEffect(() => {
        if (query.trim().length < 2) {
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
                const url = `/api/suggest/${encodeURIComponent(suggestKind)}?full=1&q=${encodeURIComponent(
                    query.trim()
                )}`;
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
                setOpen(mapped.length > 0);
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

    /* ------------------------------------------------------
       Chip selection / removal
    -------------------------------------------------------*/
    const onSelect = useCallback((chip: Chip) => {
        if (!Number.isFinite(chip.id) || chip.id <= 0) return;
        setSelected((prev) => {
            if (prev.some((c) => c.id === chip.id)) return prev;
            return [...prev, chip];
        });
        setQuery("");
        setOpen(false);
        setOptions([]);
        setHighlight(0);
        inputRef.current?.focus();
    }, []);

    const onRemove = useCallback((id: number) => {
        setSelected((prev) => prev.filter((c) => c.id !== id));
    }, []);

    const hiddenValue = useMemo(() => selected.map((c) => c.id).join(","), [selected]);

    function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (!open || !options.length) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, options.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
        } else if (e.key === "Enter") {
            e.preventDefault();
            onSelect(options[highlight]);
        } else if (e.key === "Escape") {
            setOpen(false);
        }
    }

    return (
        <div ref={rootRef} style={{ display: "grid", gap: 6, position: "relative" }}>
            <label style={{ opacity: 0.85 }}>{label}</label>

            {/* Hidden input submits IDs */}
            <input type="hidden" name={name} value={hiddenValue} />

            <div style={boxStyle}>
                {/* Chips */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {selected.map((c) => (
                        <span key={c.id} style={chipStyle} title={`${c.name}`}>
              {c.name}
                            <button
                                type="button"
                                onClick={() => onRemove(c.id)}
                                style={chipXBtn}
                                aria-label={`Remove ${c.name}`}
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
                    onFocus={() => setOpen(options.length > 0)}
                    onKeyDown={onKeyDown}
                    placeholder="Type to add…"
                    autoComplete="off"
                    style={inputStyle}
                />
            </div>

            {/* Dropdown */}
            {open && options.length > 0 ? (
                <ul style={menuStyle} role="listbox">
                    {options.map((opt, idx) => {
                        const isSel = selected.some((s) => s.id === opt.id);
                        return (
                            <li
                                key={`${opt.id}-${idx}`}
                                style={{
                                    ...menuItemStyle,
                                    background: idx === highlight ? "#263043" : "transparent",
                                    opacity: isSel ? 0.5 : 1,
                                    cursor: isSel ? "not-allowed" : "pointer"
                                }}
                                onMouseEnter={() => setHighlight(idx)}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    if (!isSel) onSelect(opt);
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
}

/* ---------- utils ---------- */

function mergeChipsReplace(prev: Chip[], next: Chip[]): Chip[] {
    // Replace any existing chip with same id; otherwise append
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
    padding: 6,
    minHeight: 44,
    display: "grid",
    alignItems: "center"
};

const inputStyle: React.CSSProperties = {
    background: "transparent",
    color: "#eaeaea",
    border: "none",
    outline: "none",
    padding: "6px 8px",
    width: "100%"
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
    fontSize: 12
};

const chipXBtn: React.CSSProperties = {
    background: "transparent",
    color: "inherit",
    border: "none",
    cursor: "pointer",
    fontSize: 14,
    lineHeight: 1
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
    zIndex: 30
};

const menuItemStyle: React.CSSProperties = {
    padding: "8px 10px",
    borderRadius: 6
};
