import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_BASE_URL } from "@/lib/env";
export const dynamic = "force-dynamic";
async function run(method: "GET" | "POST") { const token = (await cookies()).get("__gcub_a")?.value || (await cookies()).get("gc_at")?.value; if (!token) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 }); try { const path = method === "POST" ? "/games/sync-cover-images" : "/games/sync-cover-images/status"; const res = await fetch(`${API_BASE_URL}${path}`, { method, cache: "no-store", headers: { Accept: "application/json", Authorization: `Bearer ${token}` } }); return new NextResponse(await res.text(), { status: res.status, headers: { "content-type": res.headers.get("content-type") ?? "application/json", "cache-control": "no-store" } }); } catch { return NextResponse.json({ detail: "Failed to reach API cover sync" }, { status: 502 }); } }
export async function GET() { return run("GET"); }
export async function POST() { return run("POST"); }
