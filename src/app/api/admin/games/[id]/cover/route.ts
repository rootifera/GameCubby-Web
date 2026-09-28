import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_BASE_URL } from "@/lib/env";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) { const token = (await cookies()).get("__gcub_a")?.value || (await cookies()).get("gc_at")?.value; if (!token) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 }); const { id } = await props.params; try { const body = await req.formData(); const res = await fetch(`${API_BASE_URL}/games/${encodeURIComponent(id)}/cover`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body }); return new NextResponse(await res.text(), { status: res.status, headers: { "content-type": res.headers.get("content-type") ?? "application/json" } }); } catch { return NextResponse.json({ detail: "Cover upload failed" }, { status: 502 }); } }
