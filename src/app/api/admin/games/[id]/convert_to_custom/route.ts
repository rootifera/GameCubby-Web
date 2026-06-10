import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

async function readToken(): Promise<string> {
    const cookieStore = await cookies();
    return cookieStore.get("__gcub_a")?.value || cookieStore.get("gc_at")?.value || "";
}

export async function POST(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const token = await readToken();
    if (!token) {
        return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const id = encodeURIComponent(params.id);
    const variants = [
        `${API_BASE_URL}/games/${id}/convert_to_custom/`,
        `${API_BASE_URL}/games/${id}/convert_to_custom`,
    ];

    const headers: HeadersInit = {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
    };

    for (const url of variants) {
        const upstream = await fetch(url, {
            method: "POST",
            cache: "no-store",
            headers,
        });
        const text = await upstream.text();
        const response = new NextResponse(text, {
            status: upstream.status,
            headers: {
                "content-type": upstream.headers.get("content-type") ?? "application/json",
                "cache-control": "no-store",
            },
        });
        if (upstream.status !== 404 && upstream.status !== 405) return response;
    }

    return NextResponse.json({ detail: "convert_to_custom not allowed upstream" }, { status: 405 });
}

