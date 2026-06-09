// src/app/api/admin/health/route.ts
import { NextResponse } from "next/server";
import { isJwtActive, readToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
    const token = await readToken();
    const authed = token ? isJwtActive(token) : false;

    return NextResponse.json(
        { authed },
        { status: 200, headers: { "Cache-Control": "no-store" } }
    );
}
