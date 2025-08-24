// src/app/admin/login/submit/route.ts
import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/env";
import { shouldUseSecureCookies } from "@/lib/auth";

const NEW_COOKIE = "__gcub_a";
const LEGACY_COOKIE = "gc_at";
const ONE_WEEK = 60 * 60 * 24 * 7;

export async function POST(req: NextRequest) {
    const form = await req.formData();
    const username = String(form.get("username") ?? "").trim();
    const password = String(form.get("password") ?? "").trim();
    const next = String(form.get("next") ?? "/admin");

    if (!username || !password) {
        return new NextResponse(null, {
            status: 303,
            headers: { Location: `/admin/login?error=${encodeURIComponent("Missing credentials")}` },
        });
    }

    try {
        const upstream = await fetch(`${API_BASE_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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

        const isProd = process.env.NODE_ENV === "production";
        const res = new NextResponse(null, {
            status: 303,
            headers: { Location: next || "/admin" },
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
            maxAge: ONE_WEEK,
        });
        res.cookies.set({
            name: LEGACY_COOKIE,
            value: token,
            httpOnly: true,
            sameSite: "strict",
            secure: shouldBeSecure,
            path: "/",
            maxAge: ONE_WEEK,
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
