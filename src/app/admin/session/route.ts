// src/app/admin/session/route.ts
import { NextResponse } from "next/server";
import { readToken, isJwtActive } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JwtPayload = {
    sub?: string;
    username?: string;
    role?: string;
    exp?: number; // seconds since epoch
};

function decodeJwtPayload(token: string): JwtPayload | null {
    try {
        const parts = token.split(".");
        if (parts.length < 2) return null;
        const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const padded = base64 + "===".slice((base64.length + 3) % 4);
        const json = Buffer.from(padded, "base64").toString("utf8");
        return JSON.parse(json) as JwtPayload;
    } catch {
        return null;
    }
}

export async function GET() {
    const token = readToken();

    if (!token) {
        return NextResponse.json(
            { authenticated: false },
            { status: 200, headers: { "Cache-Control": "no-store" } }
        );
    }

    const payload = decodeJwtPayload(token);
    const authenticated = Boolean(payload && isJwtActive(token));

    return NextResponse.json(
        {
            authenticated,
            ...(authenticated && payload?.username ? { username: payload.username } : {}),
            ...(authenticated && payload?.role ? { role: payload.role } : {}),
        },
        { status: 200, headers: { "Cache-Control": "no-store" } }
    );
}
