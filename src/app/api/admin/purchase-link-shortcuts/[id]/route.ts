import { NextRequest, NextResponse } from "next/server";
import { readToken } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const { id } = await props.params;
    const token = await readToken();
    if (!token) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    if (!/^\d+$/.test(id)) return NextResponse.json({ detail: "Invalid shortcut id" }, { status: 400 });
    let body: string;
    try { body = await req.text(); } catch { return NextResponse.json({ detail: "Invalid request body" }, { status: 400 }); }
    try {
        const upstream = await fetch(`${API_BASE_URL}/purchase-link-shortcuts/${encodeURIComponent(id)}`, { method: "PUT", cache: "no-store", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body });
        return new NextResponse(await upstream.text(), { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") ?? "application/json", "cache-control": "no-store" } });
    } catch { return NextResponse.json({ detail: "Failed to reach API purchase link shortcut" }, { status: 502 }); }
}

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const { id } = await props.params;
    const token = await readToken();
    if (!token) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    if (!/^\d+$/.test(id)) return NextResponse.json({ detail: "Invalid shortcut id" }, { status: 400 });
    try {
        const upstream = await fetch(`${API_BASE_URL}/purchase-link-shortcuts/${encodeURIComponent(id)}`, { method: "DELETE", cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
        return new NextResponse(await upstream.text(), { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") ?? "application/json", "cache-control": "no-store" } });
    } catch { return NextResponse.json({ detail: "Failed to reach API purchase link shortcut" }, { status: 502 }); }
}
