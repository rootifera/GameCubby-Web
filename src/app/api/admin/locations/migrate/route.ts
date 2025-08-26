import { NextRequest, NextResponse } from "next/server";
import { readToken } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const token = readToken();
    if (!token) {
        return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    let payload: unknown;
    try {
        payload = await req.json();
    } catch {
        return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
    }

    // Validate required fields
    if (!payload || typeof payload !== "object") {
        return NextResponse.json({ detail: "Invalid request body" }, { status: 400 });
    }

    const { source_location_id, target_location_id } = payload as any;
    
    if (!source_location_id || !target_location_id) {
        return NextResponse.json({ 
            detail: "Both source_location_id and target_location_id are required" 
        }, { status: 400 });
    }

    if (source_location_id === target_location_id) {
        return NextResponse.json({ 
            detail: "Source and target locations must be different" 
        }, { status: 400 });
    }

    // Forward to API
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout for migration

    try {
        const upstream = await fetch(`${API_BASE_URL}/locations/migrate`, {
            method: "POST",
            signal: controller.signal,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                source: source_location_id,
                target: target_location_id,
            }),
        });

        const text = await upstream.text();
        
        if (!upstream.ok) {
            return NextResponse.json({ 
                detail: `Migration failed: ${upstream.status} ${text}` 
            }, { status: upstream.status });
        }

        // Parse the response to get the migrated count
        let result;
        try {
            result = JSON.parse(text);
        } catch {
            // If response is not JSON, assume it's just a number
            result = { migrated: parseInt(text) || 0 };
        }

        return NextResponse.json(result, {
            status: 200,
            headers: {
                "content-type": "application/json",
                "cache-control": "no-store",
            },
        });
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            return NextResponse.json({ 
                detail: "Migration request timed out" 
            }, { status: 408 });
        }
        return NextResponse.json({ 
            detail: "Failed to reach API /locations/migrate" 
        }, { status: 502 });
    } finally {
        clearTimeout(timeout);
    }
}
