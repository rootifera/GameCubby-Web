import { NextResponse } from "next/server";
import { cookies } from "next/headers";

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
    const token = cookies().get("__gcub_a")?.value || "";

    if (!token) {
        return NextResponse.json(
            { authenticated: false },
            { status: 200, headers: { "Cache-Control": "no-store" } }
        );
    }

    const payload = decodeJwtPayload(token);
    const nowSec = Math.floor(Date.now() / 1000);

    const isExpired = payload?.exp ? payload.exp <= nowSec : false;
    const authenticated = Boolean(payload && !isExpired);

    return NextResponse.json(
        {
            authenticated,
            ...(authenticated && payload?.username ? { username: payload.username } : {}),
        },
        { status: 200, headers: { "Cache-Control": "no-store" } }
    );
}
