// src/app/api/admin/health/route.ts
import { NextResponse } from "next/server";
import { hasValidSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
    const authed = await hasValidSession();

    return NextResponse.json(
        { authed },
        { status: 200, headers: { "Cache-Control": "no-store" } }
    );
}
