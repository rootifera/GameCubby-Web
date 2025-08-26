import { NextRequest, NextResponse } from "next/server";
import { requireAuthFromRequest } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/env";

export async function POST(req: NextRequest) {
    try {
        // Require authentication
        const token = requireAuthFromRequest(req);
        
        // Call the backend API
        const response = await fetch(`${API_BASE_URL}/stats/force_refresh`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            cache: "no-store",
        });

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json(
                { error: `Backend error: ${response.status} ${response.statusText}` },
                { status: response.status }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Force refresh stats error:", error);
        return NextResponse.json(
            { error: "Authentication required" },
            { status: 401 }
        );
    }
}
