import Link from "next/link";
import { isJwtActive, readToken } from "@/lib/auth";

export default async function AuthActions() {
    const token = await readToken();
    const authed = token ? isJwtActive(token) : false;

    return (
        <div className="gc-auth-actions" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {authed ? (
                <>
                    <Link href="/admin" style={btnPrimary}>Admin Panel</Link>
                    <Link href="/admin/logout" style={btnGhost}>Logout</Link>
                </>
            ) : (
                <Link href="/admin/login" style={btnPrimary}>Login</Link>
            )}
        </div>
    );
}

const btnPrimary: React.CSSProperties = {
    background: "var(--gc-accent-soft)",
    color: "#fff",
    border: "1px solid var(--gc-accent)",
    borderRadius: 8,
    padding: "8px 12px",
    fontWeight: 600,
    textDecoration: "none",
};

const btnGhost: React.CSSProperties = {
    background: "var(--gc-surface-raised)",
    color: "var(--gc-text)",
    border: "1px solid var(--gc-border)",
    borderRadius: 8,
    padding: "8px 12px",
    textDecoration: "none",
};
