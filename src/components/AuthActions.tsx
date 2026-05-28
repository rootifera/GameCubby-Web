import Link from "next/link";
import { isJwtActive, readToken } from "@/lib/auth";

export default function AuthActions() {
    const token = readToken();
    const authed = token ? isJwtActive(token) : false;

    return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
    background: "#1e293b",
    color: "#fff",
    border: "1px solid #3b82f6",
    borderRadius: 8,
    padding: "8px 12px",
    fontWeight: 600,
    textDecoration: "none",
};

const btnGhost: React.CSSProperties = {
    background: "#151515",
    color: "#eaeaea",
    border: "1px solid #2b2b2b",
    borderRadius: 8,
    padding: "8px 12px",
    textDecoration: "none",
};
