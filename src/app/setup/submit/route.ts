import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/env";

/**
 * Handles POST from /setup form:
 * - Reads form fields
 * - Calls API POST /first_run
 * - Redirects to / on success, or back to /setup with ?error=...
 *
 * NOTE: We use RELATIVE redirects so the browser stays on the current host,
 * avoiding issues like http://0.0.0.0:3000 which is not directly reachable.
 */
export async function POST(req: NextRequest) {
    const form = await req.formData();

    const admin_username = String(form.get("admin_username") ?? "").trim();
    const admin_password = String(form.get("admin_password") ?? "").trim();
    const igdb_client_id = String(form.get("igdb_client_id") ?? "").trim();
    const igdb_client_secret = String(form.get("igdb_client_secret") ?? "").trim();
    const query_limit_raw = String(form.get("query_limit") ?? "50").trim();

    // quick validation
    const errors: string[] = [];
    if (admin_username.length < 3) errors.push("Username must be at least 3 characters.");
    if (admin_password.length < 6) errors.push("Password must be at least 6 characters.");
    if (!igdb_client_id) errors.push("IGDB Client ID is required.");
    if (!igdb_client_secret) errors.push("IGDB Client Secret is required.");

    let query_limit = 50;
    const n = Number(query_limit_raw);
    if (!Number.isNaN(n) && n > 0 && n <= 10000) query_limit = Math.floor(n);

    if (errors.length) {
        return new NextResponse(null, {
            status: 303,
            headers: { Location: `/setup?error=${encodeURIComponent(errors.join(" "))}` }
        });
    }

    const payload = {
        admin_username,
        admin_password,
        igdb_client_id,
        igdb_client_secret,
        query_limit
    };

    try {
        const res = await fetch(`${API_BASE_URL}/first_run`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // first_run is public; no bearer token needed
            body: JSON.stringify(payload),
            cache: "no-store"
        });

        if (res.ok) {
            // success -> go home; Home will stop redirecting because setup is done
            return new NextResponse(null, { status: 303, headers: { Location: "/?setup=done" } });
        }

        // handle known error: "Setup already completed"
        let detail = "Setup failed.";
        try {
            const data = await res.json();
            if (typeof data?.detail === "string") detail = data.detail;
        } catch {
            const text = await res.text();
            if (text) detail = text;
        }

        if (detail.toLowerCase().includes("already")) {
            return new NextResponse(null, { status: 303, headers: { Location: "/?setup=already" } });
        }

        return new NextResponse(null, {
            status: 303,
            headers: { Location: `/setup?error=${encodeURIComponent(detail)}` }
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Network error contacting API.";
        return new NextResponse(null, {
            status: 303,
            headers: { Location: `/setup?error=${encodeURIComponent(msg)}` }
        });
    }
}
