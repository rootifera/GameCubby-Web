import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/env";

type Kind = "tags" | "igdb_tags" | "modes" | "collections" | "companies";

export async function GET(req: NextRequest, ctx: { params: { kind: string } }) {
    const kind = (ctx.params.kind || "").toLowerCase() as Kind;
    const allowed: Kind[] = ["tags", "igdb_tags", "modes", "collections", "companies"];
    if (!allowed.includes(kind)) {
        return NextResponse.json([], { status: 200, headers: { "Cache-Control": "no-store" } });
    }

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const wantFull = ["1", "true", "yes"].includes((searchParams.get("full") || "").toLowerCase());

    // Empty query -> nothing
    if (!q) {
        return NextResponse.json([], { status: 200, headers: { "Cache-Control": "no-store" } });
    }

    // Short-query fallback for TAGS ONLY using the full list (/tags/)
    if (kind === "tags" && q.length < 3) {
        try {
            const res = await fetch(`${API_BASE_URL}/tags/`, { cache: "no-store" });
            if (!res.ok) throw new Error("bad status");
            const data = (await res.json()) as Array<{ id: number; name: string }>;
            const lc = q.toLowerCase();
            const filtered = data
                .filter((t) => t?.name?.toLowerCase().includes(lc))
                .sort((a, b) => {
                    const as = a.name.toLowerCase().startsWith(lc) ? 0 : 1;
                    const bs = b.name.toLowerCase().startsWith(lc) ? 0 : 1;
                    if (as !== bs) return as - bs;
                    return a.name.localeCompare(b.name);
                })
                .slice(0, 10);

            return NextResponse.json(
                wantFull ? filtered : filtered.map((t) => t.name),
                { status: 200, headers: { "Cache-Control": "no-store" } }
            );
        } catch {
            // fall through to upstream suggest if list fetch fails
        }
    }

    // Forward to upstream /search/suggest/<kind>?q=...
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    try {
        const upstream = await fetch(
            `${API_BASE_URL}/search/suggest/${encodeURIComponent(kind)}?q=${encodeURIComponent(q)}`,
            { cache: "no-store", signal: controller.signal }
        );

        if (!upstream.ok) {
            return NextResponse.json([], { status: 200, headers: { "Cache-Control": "no-store" } });
        }

        const raw = (await upstream.json()) as unknown;

        // Normalize to array of {id,name} when full=1, else names
        const arr = Array.isArray(raw) ? raw : [];
        const objs: Array<{ id: number | string; name: string }> = [];
        for (const x of arr) {
            if (x && typeof x === "object") {
                const id = (x as any).id ?? (x as any).value ?? (x as any).key;
                const name =
                    (x as any).name ??
                    (x as any).label ??
                    (x as any).title ??
                    (typeof (x as any).value === "string" ? (x as any).value : undefined);
                if ((typeof id === "number" || typeof id === "string") && typeof name === "string") {
                    objs.push({ id, name });
                }
            } else if (typeof x === "string") {
                objs.push({ id: x, name: x });
            }
        }

        return NextResponse.json(
            wantFull ? objs.slice(0, 10) : objs.slice(0, 10).map((o) => o.name),
            { status: 200, headers: { "Cache-Control": "no-store" } }
        );
    } catch {
        return NextResponse.json([], { status: 200, headers: { "Cache-Control": "no-store" } });
    } finally {
        clearTimeout(timeout);
    }
}
