// src/app/api/health/route.ts
import { NextResponse } from "next/server";
import { readToken, isJwtActive } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
    // 1) API online check (with reduced frequency)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000); // Reduced timeout

    let online = false;
    try {
        const res = await fetch(`${API_BASE_URL}/first_run/status`, {
            cache: "no-store",
            signal: controller.signal,
        });
        online = res.ok;
    } catch (error) {
        // Only log errors in development
        if (process.env.NODE_ENV === 'development') {
            console.warn("API health check failed:", error);
        }
        online = false;
    } finally {
        clearTimeout(timeout);
    }

    // 2) Auth status from HttpOnly cookie __gcub_a
    let authed = false;
    try {
        const token = readToken();
        authed = token ? isJwtActive(token) : false;
    } catch (error) {
        if (process.env.NODE_ENV === 'development') {
            console.warn("Auth check failed:", error);
        }
        // Keep authed as false on error
    }

    return NextResponse.json(
        { online, authed },
        { 
            status: 200, 
            headers: { 
                "Cache-Control": "no-store",
                "Content-Type": "application/json"
            } 
        }
    );
}
