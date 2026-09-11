// src/app/admin/login/page.tsx
import Link from "next/link";

export const metadata = {
    title: "Admin Login • GameCubby",
    description: "Sign in to manage your library",
};

export default async function AdminLoginPage(
    props: {
        searchParams?: Promise<{ error?: string; next?: string }>;
    }
) {
    const searchParams = await props.searchParams;
    const errorMsg = searchParams?.error ? decodeURIComponent(searchParams.error) : "";
    const next = searchParams?.next || "/admin";

    return (
        <div className="gc-login" style={{ padding: 16 }}>
            <div style={{ marginBottom: 12 }}>
                <Link href="/" style={{ color: "#a0c4ff", textDecoration: "none" }}>
                    ← Back to Home
                </Link>
            </div>

            <h1 style={{ fontSize: 24, margin: "0 0 12px 0" }}>Admin Login</h1>

            {errorMsg ? (
                <div
                    style={{
                        background: "#3b0f12",
                        border: "1px solid #5b1a1f",
                        color: "#ffd7d7",
                        padding: 12,
                        borderRadius: 8,
                        marginBottom: 12,
                        maxWidth: 420,
                    }}
                >
                    {errorMsg}
                </div>
            ) : null}

            <form
                method="POST"
                action="/admin/login/submit"
                style={{
                    background: "var(--gc-surface)",
                    border: "1px solid var(--gc-border)",
                    borderRadius: 12,
                    padding: 16,
                    maxWidth: 420,
                }}
            >
                {/* Keep next hop */}
                <input type="hidden" name="next" value={next} />

                <div style={{ display: "grid", gap: 10 }}>
                    <label style={labelStyle}>
                        <span>Username</span>
                        <input
                            type="text"
                            name="username"
                            required
                            minLength={3}
                            placeholder="admin"
                            style={inputStyle}
                        />
                    </label>

                    <label style={labelStyle}>
                        <span>Password</span>
                        <input
                            type="password"
                            name="password"
                            required
                            minLength={6}
                            placeholder="••••••"
                            style={inputStyle}
                        />
                    </label>

                    <button type="submit" style={buttonStyle}>
                        Sign in
                    </button>
                </div>
            </form>
        </div>
    );
}

const labelStyle: React.CSSProperties = {
    display: "grid",
    gap: 6,
};

const inputStyle: React.CSSProperties = {
    background: "var(--gc-field)",
    color: "var(--gc-text)",
    border: "1px solid var(--gc-border)",
    borderRadius: 8,
    padding: "10px 12px",
    outline: "none",
};

const buttonStyle: React.CSSProperties = {
    background: "var(--gc-accent-soft)",
    color: "#fff",
    border: "1px solid var(--gc-accent)",
    borderRadius: 8,
    padding: "10px 14px",
    fontWeight: 600,
    cursor: "pointer",
};
