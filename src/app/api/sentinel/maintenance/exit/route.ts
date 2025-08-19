// src/app/api/sentinel/maintenance/exit/route.ts
import { NextResponse, NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const ADMIN_COOKIE = "__gcub_a";
const MAINT_COOKIE = "__gc_maint";

const DEFAULT_MAINT_PATH = "/storage/maintenance.json";
const MAINT_FILE = process.env.GC_MAINT_FILE || DEFAULT_MAINT_PATH;
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://gamecubby-api:8000";

export async function POST(req: NextRequest) {
    // Admin check (same cookie your /admin area uses)
    const token = req.cookies.get(ADMIN_COOKIE)?.value ?? "";
    if (!token) {
        return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    let apiOk = false;
    let apiStatus = 0;
    let apiError: string | null = null;
    let apiBody: any = null;

    try {
        const res = await fetch(`${API_BASE}/admin/maintenance/exit`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-gc-skip-mw": "1",
            },
            cache: "no-store",
        });
        apiStatus = res.status;
        apiBody = await res.json().catch(() => ({}));
        apiOk = res.ok && (apiBody?.ok ?? true);
        if (!res.ok) {
            apiError = apiBody?.error || `HTTP ${res.status}`;
        }
    } catch (e: any) {
        apiError = e?.message || "failed_to_contact_api";
    }

    let fileCleared = false;
    let fileError: string | null = null;
    try {
        await fs.unlink(MAINT_FILE);
        fileCleared = true;
    } catch (err: any) {
        if (err?.code === "ENOENT") {
            fileCleared = true; // already off
        } else {
            fileError = String(err?.message || err);
        }
    }

    const ok = apiOk && fileCleared;

    const res = NextResponse.json(
        {
            ok,
            enabled: false,
            api: { ok: apiOk, status: apiStatus, error: apiError, body: apiBody },
            file: { ok: fileCleared, path: path.basename(MAINT_FILE), error: fileError },
        },
        { status: ok ? 200 : 207, headers: { "Cache-Control": "no-store" } }
    );

    // Clear the maintenance cookie so middleware stops blocking pages immediately
    const secure = req.nextUrl.protocol === "https:";
    res.cookies.set(MAINT_COOKIE, "", {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure,
        maxAge: 0,
    });

    return res;
}
