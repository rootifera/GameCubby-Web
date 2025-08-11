"use client";

import { useMemo, useState } from "react";

type Props = {
    name: string;
    coverUrl?: string | null;
    width: number;
    height: number;
    rounded?: boolean;
};

export default function CoverThumb({
                                       name,
                                       coverUrl,
                                       width,
                                       height,
                                       rounded,
                                   }: Props) {
    const [imgError, setImgError] = useState(false);

    const validUrl = useMemo(() => {
        if (!coverUrl) return null;
        const u = String(coverUrl).trim();
        if (/^https?:\/\/\S+/i.test(u)) return u;
        if (/^data:image\/[a-zA-Z]+;base64,/.test(u)) return u;
        if (/^\//.test(u)) return u;
        return null;
    }, [coverUrl]);

    const showImg = !!validUrl && !imgError;

    const initials = useMemo(() => {
        const t = (name || "").trim();
        if (!t) return "—";
        const parts = t.split(/\s+/).filter(Boolean);
        return (parts[0]?.[0] ?? "").concat(parts[1]?.[0] ?? "").slice(0, 2).toUpperCase() ||
            t.slice(0, 2).toUpperCase();
    }, [name]);

    const radius = rounded ? 8 : 10;
    const border = "1px solid #2b2b2b";
    const bg = "#141414";

    if (showImg) {
        // Keep <img> simple; no flex. Inline-block + explicit width/height prevents “massive” scaling.
        // eslint-disable-next-line @next/next/no-img-element
        return (
            <img
                src={validUrl!}
                alt={name}
                width={width}
                height={height}
                style={{
                    width,
                    height,
                    display: "inline-block",
                    objectFit: "cover",
                    borderRadius: radius,
                    border,
                    background: bg,
                    boxSizing: "border-box",
                }}
                onError={() => setImgError(true)}
            />
        );
    }

    // Placeholder
    return (
        <div
            aria-label={`${name || "Unknown"} (no cover)`}
            title={name}
            style={{
                width,
                height,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: radius,
                border,
                background: bg,
                overflow: "hidden",
                boxSizing: "border-box",
            }}
        >
      <span
          style={{
              color: "#d8e0ff",
              fontWeight: 700,
              fontSize: Math.max(10, Math.floor(Math.min(width, height) * 0.45)),
              letterSpacing: 0.5,
              userSelect: "none",
          }}
      >
        {initials}
      </span>
        </div>
    );
}
