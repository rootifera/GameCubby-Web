import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

function readToken(): string {
    // Prefer the new cookie, fall back to the old one for safety.
    return cookies().get("__gcub_a")?.value || cookies().get("gc_at")?.value || "";
}

export async function POST(req: NextRequest) {
    const token = readToken();
    if (!token) {
        return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    let body: string;
    try {
        // Pass through the body as-is (expects JSON)
        body = await req.text();
    } catch {
        return NextResponse.json({ detail: "Invalid request body" }, { status: 400 });
    }

    try {
        const upstream = await fetch(`${API_BASE_URL}/games/from_igdb`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body,
            cache: "no-store",
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
            { detail: "Failed to reach API /games/from_igdb" },
            { status: 502 }
        );
    }
}
