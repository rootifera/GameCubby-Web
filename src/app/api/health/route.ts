// src/app/api/health/route.ts
import { NextResponse } from "next/server";
import { readToken, isJwtActive } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
    // 1) API online check (same as before)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    let online = false;
    try {
        const res = await fetch(`${API_BASE_URL}/first_run/status`, {
            cache: "no-store",
            signal: controller.signal,
        });
        online = res.ok;
    } catch {
        online = false;
    } finally {
        clearTimeout(timeout);
    }

    // 2) Auth status from HttpOnly cookie __gcub_a
    const token = readToken();
    const authed = token ? isJwtActive(token) : false;

    return NextResponse.json(
        { online, authed },
        { status: 200, headers: { "Cache-Control": "no-store" } }
    );
}
