import { NextRequest, NextResponse } from "next/server";
import { readToken } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

async function forward(req: NextRequest, method: "PUT" | "DELETE", id: string) {
    const token = await readToken();
    if (!token) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    if (!/^\d+$/.test(id)) return NextResponse.json({ detail: "Invalid wishlist id" }, { status: 400 });
    try {
        const body = method === "PUT" ? await req.text() : undefined;
        const upstream = await fetch(`${API_BASE_URL}/wishlist/${encodeURIComponent(id)}`, { method, cache: "no-store", headers: { Accept: "application/json", Authorization: `Bearer ${token}`, ...(method === "PUT" ? { "Content-Type": "application/json" } : {}) }, body });
        return new NextResponse(await upstream.text(), { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") ?? "application/json", "cache-control": "no-store" } });
    } catch { return NextResponse.json({ detail: "Failed to reach API wishlist item" }, { status: 502 }); }
}

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) { return forward(req, "PUT", (await props.params).id); }
export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) { return forward(req, "DELETE", (await props.params).id); }
