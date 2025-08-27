// src/app/api/health/route.ts
import { NextRequest, NextResponse } from "next/server";
import { readToken, isJwtActive } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

// Simple in-memory cache to reduce backend calls
let lastHealthCheck = 0;
let cachedHealthStatus: { online: boolean; authed: boolean } | null = null;
const CACHE_DURATION = 25000; // 25 seconds

export async function GET() {
    const now = Date.now();
    
    // Return cached result if it's still valid
    if (cachedHealthStatus && (now - lastHealthCheck) < CACHE_DURATION) {
        return NextResponse.json(cachedHealthStatus, { 
            status: 200, 
            headers: { 
                "Cache-Control": "no-store",
                "Content-Type": "application/json"
            } 
        });
    }

    // 1) API online check (with reduced frequency)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

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

    // Cache the result
    cachedHealthStatus = { online, authed };
    lastHealthCheck = now;

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
