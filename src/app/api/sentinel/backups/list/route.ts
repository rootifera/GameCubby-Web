// src/app/api/sentinel/backups/list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const COOKIE_NAME = "__gcub_a";
const BACKUPS_DIR = process.env.GC_BACKUPS_DIR || "/storage/backups";

const ALLOWED_EXT = new Set([
    ".dump",
    ".backup",
    ".pgc",
    ".pgdump",
    ".tar",
    ".pgcustom",
]);

type FileItem = {
    name: string;
    relpath: string;
    abspath: string;
    size: number;
    mtime: string; // ISO
};

export async function GET(req: NextRequest) {
    // Admin auth (same cookie as /admin)
    const token = req.cookies.get(COOKIE_NAME)?.value ?? "";
    if (!token) {
        return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    try {
        await fs.mkdir(BACKUPS_DIR, { recursive: true });
    } catch {
    }

    let entries: FileItem[] = [];
    try {
        const dirents = await fs.readdir(BACKUPS_DIR, { withFileTypes: true });

        const files = dirents.filter((d) => d.isFile());
        const items: FileItem[] = [];
        for (const f of files) {
            const full = path.join(BACKUPS_DIR, f.name);
            const ext = path.extname(f.name).toLowerCase();
            if (!ALLOWED_EXT.has(ext)) continue;

            try {
                const st = await fs.stat(full);
                if (!st.isFile()) continue;
                items.push({
                    name: f.name,
                    relpath: f.name,
                    abspath: full,
                    size: st.size,
                    mtime: new Date(st.mtimeMs).toISOString(),
                });
            } catch {
            }
        }

        items.sort((a, b) => (a.mtime < b.mtime ? 1 : a.mtime > b.mtime ? -1 : 0));
        entries = items;
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: "read_dir_failed", message: String(err?.message || err) },
            { status: 500 }
        );
    }

    return NextResponse.json(
        { ok: true, dir: BACKUPS_DIR, files: entries },
        { status: 200, headers: { "Cache-Control": "no-store" } }
    );
}
