// src/app/api/sentinel/maintenance/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

// IMPORTANT: no auth on this endpoint — middleware needs to call it
// before the user is logged in.
const DEFAULT_MAINT_PATH = "/storage/maintenance.json";
const MAINT_FILE = process.env.GC_MAINT_FILE || DEFAULT_MAINT_PATH;

type MaintJson = {
    enabled?: boolean;
    reason?: string | null;
    by?: string | null;
    started_at?: string | null;
    allow?: string[];
    nonce?: string;
};

export async function GET(_req: NextRequest) {
    let data: MaintJson | null = null;

    try {
        const raw = await fs.readFile(MAINT_FILE, "utf8");
        data = JSON.parse(raw) as MaintJson;
    } catch {
        // missing or unreadable -> treat as disabled
        data = null;
    }

    const enabled = !!data?.enabled;
    const body = {
        enabled,
        reason: data?.reason ?? null,
        by: data?.by ?? null,
        started_at: data?.started_at ?? null,
        allow: Array.isArray(data?.allow) ? data!.allow : ["/admin/sentinel/restore", "/api/sentinel/", "/health", "/_next/"],
        file: MAINT_FILE,
    };

    return NextResponse.json(body, {
        status: 200,
        headers: { "Cache-Control": "no-store" },
    });
}
