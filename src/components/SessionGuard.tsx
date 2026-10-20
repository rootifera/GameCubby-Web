"use client";

import { useEffect } from "react";

/**
 * When the admin session stops being valid on the API (password changed, SECRET_KEY rotated,
 * token expired) the admin pages still LOOK logged in -- the web app can only check its own
 * cookie -- and every action just fails with "Invalid token". This watches admin API calls and,
 * on a genuine session failure, sends the admin through /admin/logout (which clears the stale
 * cookies) to the login page.
 *
 * Only real session failures count. A 401 with another meaning (e.g. "Incorrect current password"
 * on the change-password page) must not log anyone out, so the response message is checked.
 */
const SESSION_FAILURE = /^(invalid token|not authenticated|missing user id|user not found|session is no longer valid)/i;
const PROTECTED_PREFIXES = ["/api/admin/", "/api/sentinel/"];

export default function SessionGuard() {
    useEffect(() => {
        const original = window.fetch;
        let redirecting = false;

        window.fetch = async (...args: Parameters<typeof fetch>) => {
            const response = await original(...args);
            if (response.status === 401 && !redirecting) {
                try {
                    const input = args[0];
                    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
                    const url = new URL(raw, window.location.origin);
                    const protectedCall = url.origin === window.location.origin
                        && PROTECTED_PREFIXES.some((p) => url.pathname.startsWith(p));
                    if (protectedCall) {
                        const body = await response.clone().json().catch(() => null);
                        if (typeof body?.detail === "string" && SESSION_FAILURE.test(body.detail)) {
                            redirecting = true;
                            window.location.href = "/admin/logout";
                        }
                    }
                } catch {
                    /* never let the guard break a request */
                }
            }
            return response;
        };

        return () => {
            window.fetch = original;
        };
    }, []);

    return null;
}
