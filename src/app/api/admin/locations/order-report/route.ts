// src/app/api/admin/locations/order-report/route.ts
import { NextRequest, NextResponse } from "next/server";
import { readToken } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/env";
import { fetchWithTimeout } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Read-only report on gaps / duplicates / shelves not starting at 1, across ALL locations. */
export async function GET(req: NextRequest) {
    const token = await readToken();
    if (!token) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    try {
        const upstream = await fetchWithTimeout(
            `${API_BASE_URL}/locations/order-report`,
            { cache: "no-store", headers: { Accept: "application/json", Authorization: `Bearer ${token}` } },
            60_000,
            req.signal
        );
        return new NextResponse(await upstream.text(), {
            status: upstream.status,
            headers: { "content-type": upstream.headers.get("content-type") ?? "application/json", "cache-control": "no-store" },
        });
    } catch {
        return NextResponse.json({ detail: "Failed to reach the API" }, { status: 502 });
    }
}
