"use client";

import { useMemo, useState } from "react";

type Props = {
    name: string;
    coverUrl?: string | null;
    size?: number; // px, square
};

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

function nameToMonogram(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "??";
    const a = parts[0][0] ?? "";
    const b = (parts[1]?.[0] ?? parts[0][1] ?? "").toUpperCase();
    return (a + b).toUpperCase();
}

function hueFromString(s: string) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
    return Math.abs(h) % 360;
}

export default function CoverThumb({ name, coverUrl, size = 56 }: Props) {
    const [failed, setFailed] = useState(false);
    const valid = isValidHttpUrl(coverUrl);
    const showImg = valid && !failed;

    const hue = useMemo(() => hueFromString(name), [name]);
    const bg = useMemo(
        () =>
            `linear-gradient(135deg, hsl(${hue} 60% 22%), hsl(${(hue + 24) % 360} 65% 18%))`,
        [hue]
    );
    const mono = useMemo(() => nameToMonogram(name), [name]);

    if (showImg) {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={coverUrl!}
                alt={name}
                width={size}
                height={size}
                style={{
                    width: size,
                    height: size,
                    objectFit: "cover",
                    borderRadius: 8,
                    border: "1px solid #2b2b2b",
                    background: "#141414",
                    display: "block"
                }}
                onError={() => setFailed(true)}
            />
        );
    }

    return (
        <div
            style={{
                width: size,
                height: size,
                borderRadius: 8,
                border: "1px solid #2b2b2b",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: bg,
                color: "#eaeaea",
                fontWeight: 700,
                fontSize: Math.max(12, Math.round(size * 0.36)),
                fontFamily:
                    'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
            }}
            aria-label={`${name} (no cover)`}
            title={`${name} (no cover)`}
        >
            {mono}
        </div>
    );
}
