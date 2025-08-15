import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/env";

/** Helpers like your site uses */
function parsePositiveInt(s: string | null | undefined, def: number) {
    const n = Number(s);
    if (!Number.isFinite(n)) return def;
    const i = Math.trunc(n);
    return i > 0 ? i : def;
}
function parseIdsCSV(csv: string) {
    return csv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
}

/**
 * Proxy: GET /api/proxy/search/basic?...  ->  GET {API_BASE_URL}/search/basic?...
 * Accepts:
 * - q (mapped to name), year
 * - platform_id (single) OR platform_ids (repeated)  ← NEW
 * - tag_ids (repeated supported; also accepts CSV via tag_ids=1,2,3)
 * - match_mode
 * - size, page
 */
export async function GET(req: NextRequest) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 6000);

    try {
        const incoming = new URL(req.url);
        const sp = incoming.searchParams;

        const q = (sp.get("q") ?? "").trim();
        const year = (sp.get("year") ?? "").trim();
        const match_mode = (sp.get("match_mode") ?? "").trim();

        // Platforms: prefer repeated platform_ids, else single platform_id
        const platformIdsRepeated = sp.getAll("platform_ids").filter(Boolean);
        const platformIdSingle = (sp.get("platform_id") ?? "").trim();

        // Tags: allow repeated tag_ids OR a single CSV tag_ids
        const tagIdsRepeated = sp.getAll("tag_ids").filter(Boolean);
        const tagIdsCsv = (sp.get("tag_ids") ?? "").includes(",")
            ? parseIdsCSV(sp.get("tag_ids") as string)
            : [];

        const size = Math.min(100, Math.max(5, parsePositiveInt(sp.get("size"), 20)));
        const page = parsePositiveInt(sp.get("page"), 1);

        // Build upstream query exactly how backend expects
        const qs = new URLSearchParams();
        if (q) qs.set("name", q);
        if (year) qs.set("year", year);
        if (match_mode) qs.set("match_mode", match_mode);

        if (platformIdsRepeated.length > 0) {
            platformIdsRepeated.forEach((p) => qs.append("platform_ids", p));
        } else if (platformIdSingle) {
            qs.set("platform_id", platformIdSingle);
        }

        // Repeat tag_ids
        (tagIdsRepeated.length ? tagIdsRepeated : tagIdsCsv).forEach((t) => {
            qs.append("tag_ids", t);
        });

        // Pagination (+1 extra, keeping parity with your site logic)
        const limit = Math.min(100, Math.max(1, size)) + 1;
        const offset = Math.max(0, (page - 1) * size);
        qs.set("limit", String(limit));
        qs.set("offset", String(offset));

        const upstreamUrl = `${API_BASE_URL}/search/basic?${qs.toString()}`;
        const upstream = await fetch(upstreamUrl, {
            method: "GET",
            cache: "no-store",
            headers: { Accept: "application/json" },
            signal: controller.signal,
        });

        const body = await upstream.text();
        return new NextResponse(body, {
            status: upstream.status,
            headers: {
                "content-type": upstream.headers.get("content-type") ?? "application/json",
                "cache-control": "no-store",
                "x-proxy-upstream": upstreamUrl,
            },
        });
    } catch {
        return NextResponse.json({ error: "upstream fetch failed" }, { status: 502 });
    } finally {
        clearTimeout(t);
    }
}
