import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/env";

export async function GET() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    let online = false;
    try {
        const res = await fetch(`${API_BASE_URL}/first_run/status`, {
            cache: "no-store",
            signal: controller.signal
        });
        // If the API responds at all (2xx/ok), we consider it online
        online = res.ok;
    } catch {
        online = false;
    } finally {
        clearTimeout(timeout);
    }

    return NextResponse.json({ online }, { status: 200, headers: { "Cache-Control": "no-store" } });
}
