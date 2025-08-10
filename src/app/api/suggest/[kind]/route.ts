import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/env";

type Kind = "tags" | "igdb_tags" | "modes" | "collections" | "companies";

const noStore = { "Cache-Control": "no-store" };

export async function GET(req: NextRequest, ctx: { params: { kind: string } }) {
    const kind = (ctx.params.kind || "").toLowerCase() as Kind;
    const allowed: Kind[] = ["tags", "igdb_tags", "modes", "collections", "companies"];
    if (!allowed.includes(kind)) {
        return NextResponse.json([], { status: 200, headers: noStore });
    }

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const wantFull = ["1", "true", "yes"].includes((searchParams.get("full") || "").toLowerCase());

    if (!q) return NextResponse.json([], { status: 200, headers: noStore });

    // Short-query UX boost for TAGS (optional): use full list for <3 chars
    if (kind === "tags" && q.length < 3) {
        try {
            const res = await fetch(`${API_BASE_URL}/tags/`, { cache: "no-store" });
            if (res.ok) {
                const all = (await res.json()) as Array<{ id: number; name: string }>;
                const lc = q.toLowerCase();
                const filtered = all
                    .filter((t) => t?.name?.toLowerCase().includes(lc))
                    .sort((a, b) => {
                        const as = a.name.toLowerCase().startsWith(lc) ? 0 : 1;
                        const bs = b.name.toLowerCase().startsWith(lc) ? 0 : 1;
                        if (as !== bs) return as - bs;
                        return a.name.localeCompare(b.name);
                    })
                    .slice(0, 10);
                return NextResponse.json(wantFull ? filtered : filtered.map((t) => t.name), {
                    status: 200,
                    headers: noStore
                });
            }
        } catch {
            // fall through to upstream
        }
    }

    // Forward to upstream and UNWRAP { suggestions: [...] } or accept raw []
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    try {
        const upstream = await fetch(
            `${API_BASE_URL}/search/suggest/${encodeURIComponent(kind)}?q=${encodeURIComponent(q)}`,
            { cache: "no-store", signal: controller.signal }
        );

        if (!upstream.ok) {
            return NextResponse.json([], { status: 200, headers: noStore });
        }

        const raw = await upstream.json();
        // Accept either an array or an object with .suggestions = array
        const arr: unknown[] = Array.isArray(raw)
            ? raw
            : raw && typeof raw === "object" && Array.isArray((raw as any).suggestions)
                ? (raw as any).suggestions
                : [];

        if (!wantFull) {
            // Return just names
            const names = arr
                .map((x: any) =>
                    typeof x === "string" ? x : x?.name ?? x?.label ?? x?.title ?? undefined
                )
                .filter((s: any): s is string => typeof s === "string");
            return NextResponse.json(names.slice(0, 10), { status: 200, headers: noStore });
        }

        // Normalize to {id,name}
        const objs = arr
            .map((x: any) => {
                if (typeof x === "object" && x) {
                    const id = x.id ?? x.value ?? x.key;
                    const name =
                        x.name ??
                        x.label ??
                        x.title ??
                        (typeof x.value === "string" ? x.value : undefined);
                    if ((typeof id === "number" || typeof id === "string") && typeof name === "string") {
                        return { id, name };
                    }
                } else if (typeof x === "string") {
                    // If upstream ever returns strings, pass name and echo it as id (frontend ignores non-numeric ids for tags/igdb)
                    return { id: x, name: x };
                }
                return null;
            })
            .filter(Boolean)
            .slice(0, 10);

        return NextResponse.json(objs, { status: 200, headers: noStore });
    } catch {
        return NextResponse.json([], { status: 200, headers: noStore });
    } finally {
        clearTimeout(timeout);
    }
}
