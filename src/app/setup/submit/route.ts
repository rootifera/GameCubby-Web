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
    const query_limit_raw = String(form.get("query_limit") ?? "100").trim();
    const file_storage_backend = String(form.get("file_storage_backend") ?? "local").trim().toLowerCase();
    const backup_storage_backend = String(form.get("backup_storage_backend") ?? "local").trim().toLowerCase();
    const s3_bucket = String(form.get("s3_bucket") ?? "").trim();
    const s3_region = String(form.get("s3_region") ?? "").trim();
    const s3_endpoint_url = String(form.get("s3_endpoint_url") ?? "").trim();
    const s3_access_key_id = String(form.get("s3_access_key_id") ?? "").trim();
    const s3_secret_access_key = String(form.get("s3_secret_access_key") ?? "").trim();
    const s3_prefix = String(form.get("s3_prefix") ?? "").trim().replace(/^\/+|\/+$/g, "");
    const s3_presigned_raw = String(form.get("s3_presigned_url_expires") ?? "900").trim();

    // New: public downloads (form shows Yes/No; API expects boolean)
    // Defaults to "false" when missing.
    const publicDownloadsRaw = String(form.get("public_downloads_enabled") ?? "false")
        .trim()
        .toLowerCase();
    const public_downloads_enabled =
        publicDownloadsRaw === "true" ||
        publicDownloadsRaw === "yes" ||
        publicDownloadsRaw === "1" ||
        publicDownloadsRaw === "on";

    // quick validation
    const errors: string[] = [];
    if (admin_username.length < 3) errors.push("Username must be at least 3 characters.");
    if (admin_password.length < 6) errors.push("Password must be at least 6 characters.");
    if (!igdb_client_id) errors.push("IGDB Client ID is required.");
    if (!igdb_client_secret) errors.push("IGDB Client Secret is required.");
    if (!["local", "s3"].includes(file_storage_backend)) errors.push("File storage backend must be local or S3.");
    if (!["local", "s3"].includes(backup_storage_backend)) errors.push("Backup storage backend must be local or S3.");
    if ((file_storage_backend === "s3" || backup_storage_backend === "s3") && !s3_bucket) {
        errors.push("S3 bucket is required when S3 is enabled.");
    }
    if ((file_storage_backend === "s3" || backup_storage_backend === "s3") && !s3_access_key_id) {
        errors.push("S3 access key is required when S3 is enabled.");
    }
    if ((file_storage_backend === "s3" || backup_storage_backend === "s3") && !s3_secret_access_key) {
        errors.push("S3 secret key is required when S3 is enabled.");
    }

    let query_limit = 100;
    const n = Number(query_limit_raw);
    if (!Number.isNaN(n) && n > 0 && n <= 10000) query_limit = Math.floor(n);

    let s3_presigned_url_expires = 900;
    const presign = Number(s3_presigned_raw);
    if (!Number.isNaN(presign) && presign >= 60 && presign <= 604800) {
        s3_presigned_url_expires = Math.floor(presign);
    }

    if (errors.length) {
        return new NextResponse(null, {
            status: 303,
            headers: { Location: `/setup?error=${encodeURIComponent(errors.join(" "))}` },
        });
    }

    const payload = {
        admin_username,
        admin_password,
        igdb_client_id,
        igdb_client_secret,
        query_limit,
        public_downloads_enabled, // ← send boolean to API
        file_storage_backend,
        backup_storage_backend,
        s3_bucket,
        s3_region,
        s3_endpoint_url,
        s3_access_key_id,
        s3_secret_access_key,
        s3_prefix,
        s3_presigned_url_expires,
    };

    try {
        const res = await fetch(`${API_BASE_URL}/first_run`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // first_run is public; no bearer token needed
            body: JSON.stringify(payload),
            cache: "no-store",
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
            headers: { Location: `/setup?error=${encodeURIComponent(detail)}` },
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Network error contacting API.";
        return new NextResponse(null, {
            status: 303,
            headers: { Location: `/setup?error=${encodeURIComponent(msg)}` },
        });
    }
}
