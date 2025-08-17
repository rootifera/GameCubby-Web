"use client";

import React, { useState } from "react";

export default function ChangePasswordForm() {
    const [currentPwd, setCurrentPwd] = useState("");
    const [newPwd, setNewPwd] = useState("");
    const [confirmPwd, setConfirmPwd] = useState("");

    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [err, setErr] = useState<string | null>(null);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setNotice(null);
        setErr(null);

        if (newPwd.length < 6) {
            setErr("New password must be at least 6 characters.");
            return;
        }
        if (newPwd !== confirmPwd) {
            setErr("New password and confirmation do not match.");
            return;
        }

        setBusy(true);
        try {
            // Most APIs expect { current_password, new_password } — we pass this shape.
            // The proxy forwards as-is to the upstream API.
            const res = await fetch("/api/admin/auth/change-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                cache: "no-store",
                body: JSON.stringify({
                    current_password: currentPwd,
                    new_password: newPwd,
                }),
            });

            const raw = await res.text();
            if (!res.ok) {
                // Try to pretty print validation errors (422) or fall back to message
                try {
                    const obj = raw ? JSON.parse(raw) : {};
                    if (Array.isArray(obj?.detail)) {
                        const msg = obj.detail.map((d: any) => d?.msg || JSON.stringify(d)).join("; ");
                        throw new Error(msg || `Change failed (${res.status})`);
                    }
                    if (typeof obj?.detail === "string") {
                        throw new Error(obj.detail);
                    }
                } catch {
                    /* ignore parse */
                }
                throw new Error(raw || `Change failed (${res.status})`);
            }

            setNotice("Password updated successfully.");
            setCurrentPwd("");
            setNewPwd("");
            setConfirmPwd("");
        } catch (e: any) {
            setErr(e?.message ?? "Change password failed");
        } finally {
            setBusy(false);
        }
    }

    /* styles */
    const input = {
        background: "#121212",
        color: "#eaeaea",
        border: "1px solid #262626",
        borderRadius: 8,
        padding: "10px 12px",
        outline: "none",
    } as const;

    const btn: React.CSSProperties = {
        display: "inline-block",
        background: "#1e293b",
        color: "#fff",
        border: "1px solid #3b82f6",
        borderRadius: 8,
        padding: "10px 14px",
        fontWeight: 600,
        cursor: busy ? "not-allowed" : "pointer",
        opacity: busy ? 0.8 : 1,
    };

    return (
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, maxWidth: 480 }}>
            {(notice || err) && (
                <div style={{ display: "grid", gap: 8 }}>
                    {notice && (
                        <div style={{ background: "#102418", border: "1px solid #214d2c", padding: 10, borderRadius: 8 }}>
                            {notice}
                        </div>
                    )}
                    {err && (
                        <div
                            style={{
                                background: "#3b0f12",
                                border: "1px solid #5b1a1f",
                                padding: 10,
                                borderRadius: 8,
                                color: "#ffd7d7",
                            }}
                        >
                            {err}
                        </div>
                    )}
                </div>
            )}

            <label style={{ display: "grid", gap: 6 }}>
                <span>Current password</span>
                <input
                    type="password"
                    value={currentPwd}
                    onChange={(e) => setCurrentPwd(e.target.value)}
                    style={input}
                    autoComplete="current-password"
                    required
                    minLength={1}
                />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
                <span>New password</span>
                <input
                    type="password"
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    style={input}
                    autoComplete="new-password"
                    required
                    minLength={6}
                />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
                <span>Confirm new password</span>
                <input
                    type="password"
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                    style={input}
                    autoComplete="new-password"
                    required
                    minLength={6}
                />
            </label>

            <div>
                <button type="submit" style={btn} disabled={busy}>
                    {busy ? "Saving…" : "Change Password"}
                </button>
            </div>
        </form>
    );
}
