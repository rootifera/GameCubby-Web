// src/app/api/sentinel/restore/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { getJob } from "../../_state";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const COOKIE_NAME = "__gcub_a";

export async function GET(req: NextRequest) {
    // Admin auth (same cookie as /admin)
    const token = req.cookies.get(COOKIE_NAME)?.value ?? "";
    if (!token) {
        return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const j = getJob();
    if (!j) {
        return NextResponse.json(
            { ok: true, status: "idle", job: null },
            { status: 200, headers: { "Cache-Control": "no-store" } }
        );
    }

    return NextResponse.json(
        {
            ok: true,
            status: j.status,          // "running" | "succeeded" | "failed"
            phase: j.phase,            // see _state.ts for phases
            job: {
                id: j.id,
                kind: j.kind,            // "restore" | "backup"
                started_at: j.started_at,
                finished_at: j.finished_at ?? null,
                log_file: path.basename(j.log_file),
                // restore fields (may be undefined for backups)
                dump_path: j.dump_path,
                pre_dump_file: j.pre_dump_file ?? null,
                // backup fields (may be undefined for restores)
                backup_file: j.backup_file,
                pruned: typeof j.pruned === "number" ? j.pruned : undefined,
                // common
                error: j.error ?? null,
            },
        },
        { status: 200, headers: { "Cache-Control": "no-store" } }
    );
}
