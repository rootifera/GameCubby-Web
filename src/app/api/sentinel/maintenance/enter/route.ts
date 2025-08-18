// src/app/api/sentinel/maintenance/enter/route.ts
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const COOKIE_NAME = "__gcub_a";

// Maintenance flag file (shared via ./storage:/storage)
const DEFAULT_MAINT_PATH = "/storage/maintenance.json";
const MAINT_FILE = process.env.GC_MAINT_FILE || DEFAULT_MAINT_PATH;

type MaintJson = {
    enabled: boolean;
    reason?: string | null;
    by?: string | null;
    started_at?: string | null;
    allow?: string[];         // routes that remain reachable while in maintenance
    nonce?: string;           // optional, if you ever want to rotate a guard token
};

export async function POST(req: NextRequest) {
    // ---- Admin check (same cookie as /admin) ----
    const token = req.cookies.get(COOKIE_NAME)?.value ?? "";
    if (!token) {
        return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    // ---- Parse optional body ----
    type Body = { reason?: string; by?: string; allow?: string[] };
    let body: Body = {};
    try {
        if (req.headers.get("content-type")?.includes("application/json")) {
            body = (await req.json()) as Body;
        }
    } catch {
        /* ignore bad JSON */
    }

    const reason = (body.reason || "").slice(0, 500);
    const by = (body.by || "admin").slice(0, 120);
    const allow = Array.isArray(body.allow) && body.allow.length
        ? body.allow.filter((s) => typeof s === "string").slice(0, 50)
        : [
            "/admin/login",
            "/admin/logout",
            "/admin/sentinel/restore",
            "/api/sentinel/",
            "/_next/",
            "/favicon.ico",
            "/robots.txt",
            "/sitemap.xml",
        ];

    // ---- Ensure parent dir exists ----
    try {
        await fs.mkdir(path.dirname(MAINT_FILE), { recursive: true });
    } catch {
        // ignore
    }

    const payload: MaintJson = {
        enabled: true,
        reason: reason || null,
        by,
        started_at: new Date().toISOString(),
        allow,
    };

    // ---- Write maintenance flag ----
    await fs.writeFile(MAINT_FILE, JSON.stringify(payload, null, 2), "utf8");

    return NextResponse.json(
        { ok: true, enabled: true, file: MAINT_FILE, allow, reason: payload.reason, by: payload.by, started_at: payload.started_at },
        { status: 200, headers: { "Cache-Control": "no-store" } }
    );
}
