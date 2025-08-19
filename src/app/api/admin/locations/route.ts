// src/app/api/admin/locations/route.ts
import { NextRequest, NextResponse } from "next/server";
import { readToken } from "@/lib/auth";
import { validateString, validatePositiveInt } from "@/lib/validation";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/locations
 * Proxies to GET {API_BASE_URL}/locations/ (public)
 */
export async function GET() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
        const upstream = await fetch(`${API_BASE_URL}/locations/`, {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
            headers: { Accept: "application/json" },
        });

        const text = await upstream.text();
        return new NextResponse(text, {
            status: upstream.status,
            headers: {
                "content-type": upstream.headers.get("content-type") ?? "application/json",
                "cache-control": "no-store",
            },
        });
    } catch {
        return NextResponse.json(
            { detail: "Failed to reach API /locations/" },
            { status: 502 }
        );
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * POST /api/admin/locations
 * Adds a location via upstream POST /locations/?name=...&parent_id=...&type=...
 * Requires Bearer token from cookie.
 *
 * Accepts either:
 *  - JSON body: { name: string, parent_id?: number, type?: string }
 *  - or query params on this route (?name=...&parent_id=...&type=...)
 */
export async function POST(req: NextRequest) {
    const token = readToken();
    if (!token) {
        return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    // Collect inputs from JSON body (preferred) or fallback to our own query params
    let name = "";
    let parent_id: number | undefined;
    let type: string | undefined;

    try {
        const ctype = req.headers.get("content-type") || "";
        if (ctype.includes("application/json")) {
            const body = await req.json().catch(() => ({} as any));
            name = validateString(body?.name, 1, 100) || "";
            parent_id = typeof body?.parent_id === "number" ? validatePositiveInt(String(body.parent_id), 1, 999999) : undefined;
            type = validateString(body?.type, 1, 50) || undefined;
        } else if (ctype.includes("application/x-www-form-urlencoded") || ctype.includes("multipart/form-data")) {
            const form = await req.formData();
            const n = form.get("name");
            const pid = form.get("parent_id");
            const t = form.get("type");
            name = validateString(n, 1, 100) || "";
            parent_id = validatePositiveInt(pid, 1, 999999);
            type = validateString(t, 1, 50) || undefined;
        }

        // Fallback to query params of this proxy route
        const sp = req.nextUrl.searchParams;
        if (!name && sp.get("name")) name = validateString(sp.get("name"), 1, 100) || "";
        if (parent_id === undefined && sp.get("parent_id")) {
            parent_id = validatePositiveInt(sp.get("parent_id"), 1, 999999);
        }
        if (!type && sp.get("type")) type = validateString(sp.get("type"), 1, 50) || undefined;
    } catch {
        // ignore, we validate below
    }

    if (!name) {
        return NextResponse.json({ detail: "Missing required 'name'." }, { status: 400 });
    }

    // Build upstream URL with query params as required by the API spec
    const qs = new URLSearchParams();
    qs.set("name", name);
    if (parent_id !== undefined) qs.set("parent_id", String(parent_id));
    if (type) qs.set("type", type);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
        const upstream = await fetch(`${API_BASE_URL}/locations/?${qs.toString()}`, {
            method: "POST",
            cache: "no-store",
            signal: controller.signal,
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${token}`,
            },
            // Body not required by upstream spec (params in query)
        });

        const text = await upstream.text();
        return new NextResponse(text, {
            status: upstream.status,
            headers: {
                "content-type": upstream.headers.get("content-type") ?? "application/json",
                "cache-control": "no-store",
            },
        });
    } catch {
        return NextResponse.json(
            { detail: "Failed to reach API /locations/ (POST)" },
            { status: 502 }
        );
    } finally {
        clearTimeout(timeout);
    }
}
