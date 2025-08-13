// src/app/admin/logout/route.ts
import { NextResponse } from "next/server";

const COOKIE_NAME = "__gcub_a";

export async function GET() {
    const isProd = process.env.NODE_ENV === "production";
    const cookie = [
        `${COOKIE_NAME}=`,
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        "Max-Age=0",
        isProd ? "Secure" : null,
    ]
        .filter(Boolean)
        .join("; ");

    return new NextResponse(null, {
        status: 303,
        headers: {
            "Set-Cookie": cookie,
            Location: "/admin/login",
        },
    });
}
