import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

function readToken(): string {
    // Prefer the obscure cookie you’re actually setting, fall back to the older name.
    return cookies().get("__gcub_a")?.value || cookies().get("gc_at")?.value || "";
}

export async function GET(
    _req: Request,
    { params }: { params: { igdb_id: string } }
) {
    const token = readToken();
    if (!token) {
        return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const { igdb_id } = params;
    if (!/^\d+$/.test(igdb_id)) {
        return NextResponse.json({ detail: "Invalid id" }, { status: 400 });
    }

    try {
        const upstream = await fetch(`${API_BASE_URL}/igdb/game/${igdb_id}`, {
            cache: "no-store",
            headers: { Authorization: `Bearer ${token}` },
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
            { detail: "Failed to reach API /igdb/game/{id}" },
            { status: 502 }
        );
    }
}
