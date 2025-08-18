// src/app/api/sentinel/restore/logs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getJob } from "../../_state";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const COOKIE_NAME = "__gcub_a";
const MAX_READ = 128 * 1024; // 128 KiB per request

export async function GET(req: NextRequest) {
    // Admin check (same cookie as /admin)
    const token = req.cookies.get(COOKIE_NAME)?.value ?? "";
    if (!token) {
        return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const job = getJob();
    if (!job) {
        return NextResponse.json(
            { ok: true, job: null, chunk: "", next_offset: 0, eof: true, note: "no_active_job" },
            { status: 200, headers: { "Cache-Control": "no-store" } }
        );
    }

    const logFile = job.log_file;
    let stat;
    try {
        stat = await fs.stat(logFile);
        if (!stat.isFile()) {
            return NextResponse.json(
                { ok: false, error: "log_not_file", path: logFile },
                { status: 404 }
            );
        }
    } catch {
        return NextResponse.json(
            { ok: false, error: "log_missing", path: logFile },
            { status: 404 }
        );
    }

    // Parse ?offset
    const url = new URL(req.url);
    let offset = 0;
    const offParam = url.searchParams.get("offset");
    if (offParam) {
        const n = Number(offParam);
        if (Number.isFinite(n) && n >= 0) offset = Math.trunc(n);
    }

    const fileSize = stat.size;
    if (offset > fileSize) offset = fileSize;

    const remaining = fileSize - offset;
    const toRead = Math.min(remaining, MAX_READ);

    let chunk = "";
    if (toRead > 0) {
        const fh = await fs.open(logFile, "r");
        try {
            const buf = Buffer.allocUnsafe(toRead);
            const { bytesRead } = await fh.read(buf, 0, toRead, offset);
            chunk = buf.subarray(0, bytesRead).toString("utf8");
            offset += bytesRead;
        } finally {
            await fh.close();
        }
    }

    const eof = offset >= fileSize && (job.status === "succeeded" || job.status === "failed");

    return NextResponse.json(
        {
            ok: true,
            job: {
                id: job.id,
                status: job.status,
                phase: job.phase,
                started_at: job.started_at,
                finished_at: job.finished_at ?? null,
                log_file: path.basename(logFile),
            },
            chunk,
            next_offset: offset,
            eof,
            size: fileSize,
        },
        { status: 200, headers: { "Cache-Control": "no-store" } }
    );
}
