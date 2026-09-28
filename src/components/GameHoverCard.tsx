"use client";

import { useEffect, useRef, useState } from "react";
import CoverThumb from "@/components/CoverThumb";

/* ------- types ------- */

type Platform = { id: number; name: string };
type LocationNode = { id: string | number; name: string };
type GameDetails = {
    id: number;
    name: string;
    cover_url?: string | null;
    release_date?: number | null;
    rating?: number | null;
    platforms?: Platform[];
    summary?: string | null;            // kept, but we won't show it
    location_path?: LocationNode[];     // NEW
    order?: number | null;              // NEW
    condition?: number | null;          // NEW
};

function toYear(n?: number | null): string {
    if (n == null) return "—";
    if (n >= 1000 && n <= 3000) return String(n);
    if (n >= 1_000_000_000_000) return String(new Date(n).getUTCFullYear());
    if (n >= 1_000_000_000) return String(new Date(n * 1000).getUTCFullYear());
    return String(n);
}

async function fetchGameViaProxy(id: number): Promise<GameDetails> {
    const res = await fetch(`/api/proxy/games/${id}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`GET /api/proxy/games/${id} -> ${res.status}`);
    return (await res.json()) as GameDetails;
}

/* ------- component ------- */

export default function GameHoverCard({
                                          gameId,
                                          children,
                                      }: {
    gameId: number;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const [touchMode, setTouchMode] = useState(false);
    const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [data, setData] = useState<GameDetails | null>(null);
    const [error, setError] = useState<string | null>(null);
    const loadedRef = useRef(false);
    const enterTimer = useRef<number | null>(null);
    const wrapRef = useRef<HTMLSpanElement | null>(null);
    const cardRef = useRef<HTMLDivElement | null>(null);
    const lastPointerType = useRef<string>("");

    function clearEnterTimer() {
        if (enterTimer.current) {
            clearTimeout(enterTimer.current);
            enterTimer.current = null;
        }
    }

    function scheduleOpen() {
        if (open || enterTimer.current) return;
        setTouchMode(false);
        enterTimer.current = window.setTimeout(() => {
            enterTimer.current = null;
            setOpen(true);
        }, 120);
    }
    function onLeave() {
        if (touchMode) return;
        clearEnterTimer();
        setOpen(false);
    }
    function onMove(e: React.PointerEvent) {
        if (e.pointerType === "touch") return;
        scheduleOpen();
        const pad = 16;
        const w = 320;
        const h = 220;
        let x = e.clientX + 14;
        let y = e.clientY + 14;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        if (x + w + pad > vw) x = Math.max(pad, vw - w - pad);
        if (y + h + pad > vh) y = Math.max(pad, vh - h - pad);
        setPos({ x, y });
    }

    function openForTouch() {
        clearEnterTimer();
        const pad = 12;
        const vw = window.innerWidth;
        const width = Math.min(360, vw - pad * 2);
        setPos({
            x: Math.max(pad, Math.floor((vw - width) / 2)),
            y: 88,
        });
        setTouchMode(true);
        setOpen(true);
    }

    function onPointerDownCapture(e: React.PointerEvent) {
        lastPointerType.current = e.pointerType;
    }

    function onClickCapture(e: React.MouseEvent) {
        const isTouchLike =
            lastPointerType.current === "touch" ||
            (typeof window !== "undefined" && window.matchMedia("(hover: none)").matches);
        if (!isTouchLike) return;
        if (!open || !touchMode) {
            e.preventDefault();
            e.stopPropagation();
            openForTouch();
        }
    }

    useEffect(() => () => clearEnterTimer(), []);

    useEffect(() => {
        if (!open || !touchMode) return;
        function onDocPointerDown(e: PointerEvent) {
            const target = e.target as Node;
            if (wrapRef.current?.contains(target) || cardRef.current?.contains(target)) return;
            setOpen(false);
            setTouchMode(false);
        }
        document.addEventListener("pointerdown", onDocPointerDown);
        return () => document.removeEventListener("pointerdown", onDocPointerDown);
    }, [open, touchMode]);

    useEffect(() => {
        if (!open || loadedRef.current) return;
        loadedRef.current = true;
        fetchGameViaProxy(gameId)
            .then((g) => setData(g))
            .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
    }, [open, gameId]);

    return (
        <span
            ref={wrapRef}
            onPointerDownCapture={onPointerDownCapture}
            onClickCapture={onClickCapture}
            onPointerEnter={scheduleOpen}
            onPointerLeave={onLeave}
            onPointerMove={onMove}
            style={{ position: "relative", display: "inline-block" }}
        >
      {children}

            {open ? (
                <div
                    ref={cardRef}
                    style={{
                        position: "fixed",
                        left: pos.x,
                        top: pos.y,
                        width: touchMode ? "calc(100vw - 24px)" : 320,
                        maxWidth: touchMode ? 360 : undefined,
                        zIndex: 9999,
                        background: "#0f0f0f",
                        border: "1px solid var(--gc-border)",
                        borderRadius: 12,
                        boxShadow: "0 6px 20px rgba(0,0,0,0.45)",
                        padding: 10,
                        color: "var(--gc-text)",
                        pointerEvents: touchMode ? "auto" : "none",
                    }}
                >
                    {touchMode ? (
                        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
                            <button
                                type="button"
                                onClick={() => {
                                    setOpen(false);
                                    setTouchMode(false);
                                }}
                                aria-label="Close preview"
                                style={{
                                    background: "#171717",
                                    border: "1px solid #303030",
                                    borderRadius: 8,
                                    color: "var(--gc-text)",
                                    cursor: "pointer",
                                    fontSize: 12,
                                    padding: "4px 8px",
                                }}
                            >
                                Close
                            </button>
                        </div>
                    ) : null}
                    {!data && !error ? (
                        <div style={{ fontSize: 12, opacity: 0.8 }}>Loading…</div>
                    ) : error ? (
                        <div style={{ fontSize: 12, color: "#fca5a5" }}>Failed to load</div>
                    ) : data ? (
                        <CardContent g={data} touchMode={touchMode} />
                    ) : null}
                </div>
            ) : null}
    </span>
    );
}

/* ------- inner content ------- */

function CardContent({ g, touchMode = false }: { g: GameDetails; touchMode?: boolean }) {
    const platforms = (g.platforms ?? []).map((p) => p.name).join(", ") || "—";
    const locationStr =
        (g.location_path && g.location_path.length
            ? g.location_path.map((n) => n.name).join(" > ")
            : "") || "";

    return (
        <div style={{ display: "grid", gridTemplateColumns: "64px 1fr", gap: 10, alignItems: "center" }}>
            {/* Cover / placeholder */}
            <CoverThumb
                name={g.name}
                coverUrl={g.cover_url}
                gameId={g.id}
                width={64}
                height={64}
                rounded
            />

            {/* Text */}
            <div>
                <div style={{ fontWeight: 700, marginBottom: 2 }}>{g.name}</div>
                <div style={{ fontSize: 12, opacity: 0.85 }}>
                    Year: {toYear(g.release_date)} · Rating: {g.rating ?? "—"}
                </div>
                <div style={{ fontSize: 12, opacity: 0.85 }}>Platforms: {platforms}</div>
            </div>

            {/* Location / Order */}
            <div style={{ gridColumn: "1 / span 2", marginTop: 8 }}>
                <div style={{ fontSize: 12, opacity: 0.9 }}>
                    <span style={{ opacity: 0.75 }}>Location:</span>{" "}
                    {locationStr ? locationStr : "Not set"}
                    {typeof g.order === "number" && g.order > 0 ? ` > ${g.order}` : ""}
                </div>
            </div>

            {touchMode ? (
                <a
                    href={`/games/${g.id}`}
                    style={{
                        gridColumn: "1 / span 2",
                        textAlign: "center",
                        textDecoration: "none",
                        background: "var(--gc-accent-soft)",
                        border: "1px solid var(--gc-accent)",
                        color: "#e5f0ff",
                        padding: "9px 10px",
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 600,
                    }}
                >
                    Open details
                </a>
            ) : null}
        </div>
    );
}
