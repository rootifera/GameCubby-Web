import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    // Accept either cookie name (some setups use __gcub_a)
    const token =
        cookies().get("gc_at")?.value ||
        cookies().get("__gcub_a")?.value ||
        null;

    if (!token) {
        return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);

    try {
        const upstream = await fetch(`${API_BASE_URL}/platforms/`, {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
            headers: {
                Authorization: `Bearer ${token}`,
            },
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
        return NextResponse.json({ error: "Failed to reach API /platforms/" }, { status: 502 });
    } finally {
        clearTimeout(t);
    }
}
