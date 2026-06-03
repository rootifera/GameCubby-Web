import { NextRequest, NextResponse } from "next/server";
import { requireAuthFromRequest } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/env";

export async function POST(req: NextRequest) {
    let token: string;
    try {
        token = requireAuthFromRequest(req);
    } catch {
        return NextResponse.json(
            { detail: "Not authenticated" },
            { status: 401 }
        );
    }

    try {
        const upstream = await fetch(`${API_BASE_URL}/stats/force_refresh`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
            },
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
            { detail: "Failed to reach API /stats/force_refresh" },
            { status: 502 }
        );
    }
}
