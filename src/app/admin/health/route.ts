// src/app/api/admin/health/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

/** Soft-validate JWT by decoding payload and checking exp (no signature check). */
function isJwtActive(token: string): boolean {
    try {
        const parts = token.split(".");
        if (parts.length < 2) return false;
        const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
        const json = Buffer.from(b64 + pad, "base64").toString("utf8");
        const payload = JSON.parse(json) as { exp?: number };
        if (typeof payload.exp !== "number") return true; // no exp -> treat as active
        const now = Math.floor(Date.now() / 1000);
        return payload.exp > now;
    } catch {
        return false;
    }
}

export async function GET() {
    const token = cookies().get("__gcub_a")?.value || "";
    const authed = token ? isJwtActive(token) : false;

    return NextResponse.json(
        { authed },
        { status: 200, headers: { "Cache-Control": "no-store" } }
    );
}
