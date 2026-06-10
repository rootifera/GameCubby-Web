// src/app/api/sentinel/backups/sync-storage/route.ts
import { NextRequest, NextResponse } from "next/server";
import { hasActiveTokenFromRequest, readTokenFromRequest } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    if (!hasActiveTokenFromRequest(req)) {
        return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    let body = "";
    try {
        body = await req.text();
    } catch {
        return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
    }

    try {
        const upstream = await fetch(`${API_BASE_URL}/backup/sync-storage`, {
            method: "POST",
            cache: "no-store",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: `Bearer ${readTokenFromRequest(req)}`,
            },
            body,
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
        return NextResponse.json({ ok: false, error: "backup_sync_failed" }, { status: 502 });
    }
}
