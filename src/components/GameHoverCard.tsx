"use client";

import { useEffect, useRef, useState } from "react";

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

/* ------- helpers ------- */

function isValidHttpUrl(s?: string | null): s is string {
    if (!s) return false;
    const t = s.trim();
    if (!t) return false;
    try {
        const u = new URL(t);
        return u.protocol === "http:" || u.protocol === "https:";
    } catch {
        return false;
    }
}

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
    const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [data, setData] = useState<GameDetails | null>(null);
    const [error, setError] = useState<string | null>(null);
    const loadedRef = useRef(false);
    const enterTimer = useRef<number | null>(null);

    function onEnter() {
        enterTimer.current = window.setTimeout(() => setOpen(true), 120);
    }
    function onLeave() {
        if (enterTimer.current) {
            clearTimeout(enterTimer.current);
            enterTimer.current = null;
        }
        setOpen(false);
    }
    function onMove(e: React.MouseEvent) {
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

    useEffect(() => {
        if (!open || loadedRef.current) return;
        loadedRef.current = true;
        fetchGameViaProxy(gameId)
            .then((g) => setData(g))
            .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
    }, [open, gameId]);

    return (
        <span
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
            onMouseMove={onMove}
            style={{ position: "relative", display: "inline-block" }}
        >
      {children}

            {open ? (
                <div
                    style={{
                        position: "fixed",
                        left: pos.x,
                        top: pos.y,
                        width: 320,
                        zIndex: 9999,
                        background: "#0f0f0f",
                        border: "1px solid #2b2b2b",
                        borderRadius: 12,
                        boxShadow: "0 6px 20px rgba(0,0,0,0.45)",
                        padding: 10,
                        color: "#eaeaea",
                        pointerEvents: "none",
                    }}
                >
                    {!data && !error ? (
                        <div style={{ fontSize: 12, opacity: 0.8 }}>Loading…</div>
                    ) : error ? (
                        <div style={{ fontSize: 12, color: "#fca5a5" }}>Failed to load</div>
                    ) : data ? (
                        <CardContent g={data} />
                    ) : null}
                </div>
            ) : null}
    </span>
    );
}

/* ------- inner content ------- */

function CardContent({ g }: { g: GameDetails }) {
    const platforms = (g.platforms ?? []).map((p) => p.name).join(", ") || "—";
    const locationStr =
        (g.location_path && g.location_path.length
            ? g.location_path.map((n) => n.name).join(" > ")
            : "") || "";

    return (
        <div style={{ display: "grid", gridTemplateColumns: "64px 1fr", gap: 10, alignItems: "center" }}>
            {/* Cover / placeholder */}
            <div
                style={{
                    width: 64,
                    height: 64,
                    borderRadius: 8,
                    border: "1px solid #2b2b2b",
                    background: "#141414",
                    overflow: "hidden",
                }}
            >
                {isValidHttpUrl(g.cover_url) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={g.cover_url!}
                        alt={g.name}
                        width={64}
                        height={64}
                        style={{ width: 64, height: 64, objectFit: "cover", display: "block" }}
                    />
                ) : (
                    <div style={{ width: "100%", height: "100%", background: "#1b1b1b" }} />
                )}
            </div>

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
                    {typeof g.order === "number" ? ` > Order: ${g.order}` : ""}
                </div>
            </div>
        </div>
    );
}
