// src/app/admin/login/submit/route.ts
import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/env";
import { safeNextPath, shouldUseSecureCookies, trustedClientIp } from "@/lib/auth";
import { SESSION_PROOF_COOKIE, signSessionProof } from "@/lib/session";

const NEW_COOKIE = "__gcub_a";
const LEGACY_COOKIE = "gc_at";
const ONE_DAY = 60 * 60 * 24;

export async function POST(req: NextRequest) {
    const form = await req.formData();
    const username = String(form.get("username") ?? "").trim();
    const password = String(form.get("password") ?? "").trim();
    const next = safeNextPath(String(form.get("next") ?? "/admin"));

    if (!username || !password) {
        return new NextResponse(null, {
            status: 303,
            headers: { Location: `/admin/login?error=${encodeURIComponent("Missing credentials")}` },
        });
    }

    try {
        const clientIp = trustedClientIp(req);
        const upstream = await fetch(`${API_BASE_URL}/auth/login`, {
            method: "POST",
            // X-Real-IP lets the API rate-limit per visitor instead of per web server.
            headers: { "Content-Type": "application/json", ...(clientIp ? { "X-Real-IP": clientIp } : {}) },
            cache: "no-store",
            body: JSON.stringify({ username, password }),
        });

        if (!upstream.ok) {
            let detail = "Invalid credentials";
            try {
                const data = await upstream.json();
                if (typeof data?.detail === "string") detail = data.detail;
            } catch {
                const t = await upstream.text();
                if (t) detail = t;
            }
            return new NextResponse(null, {
                status: 303,
                headers: { Location: `/admin/login?error=${encodeURIComponent(detail)}&next=${encodeURIComponent(next)}` },
            });
        }

        const data = (await upstream.json()) as {
            access_token?: string;
            token_type?: string;
        };

        const token = String(data?.access_token || "");
        if (!token) {
            return new NextResponse(null, {
                status: 303,
                headers: { Location: `/admin/login?error=${encodeURIComponent("Missing access token")}` },
            });
        }

        const res = new NextResponse(null, {
            status: 303,
            headers: {
                Location: next,
                "Cache-Control": "no-store",
            },
        });

        // Determine if cookies should be secure based on PROXY setting
        const shouldBeSecure = shouldUseSecureCookies(req);

        // Set BOTH cookies for compatibility
        res.cookies.set({
            name: NEW_COOKIE,
            value: token,
            httpOnly: true,
            sameSite: "strict",
            secure: shouldBeSecure,
            path: "/",
            maxAge: ONE_DAY,
        });
        res.cookies.set({
            name: LEGACY_COOKIE,
            value: token,
            httpOnly: true,
            sameSite: "strict",
            secure: shouldBeSecure,
            path: "/",
            maxAge: ONE_DAY,
        });
        // Proof that this token came from a login we handled (see lib/session.ts).
        res.cookies.set({
            name: SESSION_PROOF_COOKIE,
            value: signSessionProof(token),
            httpOnly: true,
            sameSite: "strict",
            secure: shouldBeSecure,
            path: "/",
            maxAge: ONE_DAY,
        });

        return res;
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Login failed";
        return new NextResponse(null, {
            status: 303,
            headers: { Location: `/admin/login?error=${encodeURIComponent(msg)}&next=${encodeURIComponent(next)}` },
        });
    }
}
