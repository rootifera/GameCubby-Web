import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/env";

function normalizeNames(list: unknown): string[] {
    const arr = Array.isArray(list) ? list : [];
    const out: string[] = [];
    for (const x of arr) {
        if (typeof x === "string") {
            out.push(x);
        } else if (x && typeof x === "object") {
            // be defensive about upstream shape
            const name =
                (x as any).name ??
                (x as any).label ??
                (x as any).title ??
                (typeof (x as any).value === "string" ? (x as any).value : undefined);
            if (typeof name === "string") out.push(name);
        }
    }
    // dedupe + trim empties
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const n of out) {
        const key = n.trim();
        if (!key) continue;
        if (!seen.has(key)) {
            seen.add(key);
            deduped.push(key);
        }
    }
    return deduped;
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const lc = q.toLowerCase();

    // empty query -> empty list
    if (!q) {
        return NextResponse.json([], {
            status: 200,
            headers: { "Cache-Control": "no-store" }
        });
    }

    // If the query is short (<3), many APIs won't suggest. Fallback:
    // fetch /games/ and do a lightweight local filter.
    if (q.length < 3) {
        try {
            const res = await fetch(`${API_BASE_URL}/games/`, { cache: "no-store" });
            if (!res.ok) throw new Error("bad status");
            const data = await res.json();
            const names = normalizeNames(data);
            // rank: startsWith first, then includes; case-insensitive
            const filtered = names
                .filter((n) => n.toLowerCase().includes(lc))
                .sort((a, b) => {
                    const aStarts = a.toLowerCase().startsWith(lc) ? 0 : 1;
                    const bStarts = b.toLowerCase().startsWith(lc) ? 0 : 1;
                    if (aStarts !== bStarts) return aStarts - bStarts;
                    return a.localeCompare(b);
                })
                .slice(0, 8);

            return NextResponse.json(filtered, {
                status: 200,
                headers: { "Cache-Control": "no-store" }
            });
        } catch {
            return NextResponse.json([], {
                status: 200,
                headers: { "Cache-Control": "no-store" }
            });
        }
    }

    // 3+ chars: use the real suggest endpoint
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    try {
        const upstream = await fetch(
            `${API_BASE_URL}/search/suggest/names?q=${encodeURIComponent(q)}`,
            { cache: "no-store", signal: controller.signal }
        );

        if (!upstream.ok) {
            return NextResponse.json([], {
                status: 200,
                headers: { "Cache-Control": "no-store" }
            });
        }

        const raw = await upstream.json();
        const names = normalizeNames(raw);
        // sort alphabetically; backend already relevance-ranks typically
        const out = names.slice(0, 8);
        return NextResponse.json(out, {
            status: 200,
            headers: { "Cache-Control": "no-store" }
        });
    } catch {
        return NextResponse.json([], {
            status: 200,
            headers: { "Cache-Control": "no-store" }
        });
    } finally {
        clearTimeout(timeout);
    }
}
