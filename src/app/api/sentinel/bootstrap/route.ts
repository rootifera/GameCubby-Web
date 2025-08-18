// src/app/api/sentinel/maintenance/bootstrap/route.ts
import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const COOKIE_NAME = "__gcub_a";

const DB_HOST = process.env.DB_HOST || "gamecubby-db";
const DB_PORT = String(process.env.DB_PORT || "5432");
const DB_USER = process.env.DB_USER || "gamecubby";
const DB_PASSWORD = process.env.DB_PASSWORD || "";

const MAINT_USER = process.env.MAINT_DB_USER || "gc_maint";
const MAINT_PASSWORD = process.env.MAINT_DB_PASSWORD || "";

function runPsqlCapture(args: string[], env: Record<string, string>): Promise<{ code: number; out: string; err: string }> {
    return new Promise((resolve) => {
        const child = spawn("psql", args, { env: { ...process.env, ...env } });
        let out = "";
        let err = "";
        child.stdout.on("data", (d) => (out += d.toString()));
        child.stderr.on("data", (d) => (err += d.toString()));
        child.on("close", (code) => resolve({ code: code ?? 0, out, err }));
    });
}

export async function POST(req: NextRequest) {
    const token = req.cookies.get(COOKIE_NAME)?.value ?? "";
    if (!token) {
        return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    if (!MAINT_PASSWORD) {
        return NextResponse.json(
            { ok: false, error: "missing_env", message: "MAINT_DB_PASSWORD is not set in .env" },
            { status: 400 }
        );
    }

    const checkArgs = [
        "-h", DB_HOST,
        "-p", DB_PORT,
        "-U", DB_USER,
        "-d", "postgres",
        "-tAc",
        `SELECT 1 FROM pg_roles WHERE rolname='${MAINT_USER.replace(/'/g, "''")}'`,
    ];
    const check = await runPsqlCapture(checkArgs, { PGPASSWORD: DB_PASSWORD });
    if (check.code !== 0) {
        return NextResponse.json(
            { ok: false, error: "psql_error", phase: "check", details: check.err || check.out },
            { status: 500 }
        );
    }
    const exists = check.out.trim().startsWith("1");

    const pwLit = MAINT_PASSWORD.replace(/'/g, "''");
    const roleLit = MAINT_USER.replace(/"/g, '""');
    const sql = exists
        ? `ALTER ROLE "${roleLit}" WITH LOGIN SUPERUSER PASSWORD '${pwLit}';`
        : `CREATE ROLE "${roleLit}" WITH LOGIN SUPERUSER PASSWORD '${pwLit}';`;

    const applyArgs = [
        "-h", DB_HOST,
        "-p", DB_PORT,
        "-U", DB_USER,
        "-d", "postgres",
        "-v", "ON_ERROR_STOP=1",
        "-c", sql,
    ];
    const apply = await runPsqlCapture(applyArgs, { PGPASSWORD: DB_PASSWORD });
    if (apply.code !== 0) {
        return NextResponse.json(
            { ok: false, error: "psql_error", phase: "apply", details: apply.err || apply.out },
            { status: 500 }
        );
    }

    // 3) Return success
    return NextResponse.json(
        {
            ok: true,
            action: exists ? "updated" : "created",
            role: MAINT_USER,
            note: "Maintenance role ensured",
        },
        { status: 200, headers: { "Cache-Control": "no-store" } }
    );
}
