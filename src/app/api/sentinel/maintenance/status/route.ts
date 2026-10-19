// src/app/api/sentinel/maintenance/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { readMaintenance } from "@/lib/maintenance";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

// No auth on purpose: the restore page must be able to show the state while the session
// check is unavailable. It exposes only the state, never server paths.
export async function GET(_req: NextRequest) {
    const { enabled, reason, by, started_at, allow } = readMaintenance({ fresh: true });
    return NextResponse.json(
        { enabled, reason, by, started_at, allow },
        { status: 200, headers: { "Cache-Control": "no-store" } }
    );
}
