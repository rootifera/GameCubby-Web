import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const name = (searchParams.get("name") || "").trim();
    const gcAt = cookies().get("gc_at")?.value;

    if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });

    try {
        const upstream = await fetch(
            `${API_BASE_URL}/tags/?name=${encodeURIComponent(name)}`,
            {
                method: "POST",
                cache: "no-store",
                headers: gcAt ? { Authorization: `Bearer ${gcAt}` } : undefined,
            }
        );

        const text = await upstream.text();
        return new NextResponse(text, {
            status: upstream.status,
            headers: {
                "content-type": upstream.headers.get("content-type") ?? "application/json",
                "cache-control": "no-store",
            },
        });
    } catch {
        return NextResponse.json({ error: "Failed to reach API /tags/" }, { status: 502 });
    }
}
