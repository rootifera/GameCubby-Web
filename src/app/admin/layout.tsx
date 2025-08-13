import Link from "next/link";
import { cookies } from "next/headers";

export const metadata = {
    title: "Admin • GameCubby",
    description: "Admin panel",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    // Simple flag: do we have an admin token cookie?
    const isAuthed = Boolean(cookies().get("__gcub_a")?.value);

    const itemStyle: React.CSSProperties = {
        display: "block",
        padding: "8px 10px",
        borderRadius: 8,
        textDecoration: "none",
        color: "#eaeaea",
        border: "1px solid transparent",
    };

    const disabledStyle: React.CSSProperties = {
        ...itemStyle,
        opacity: 0.5,
        cursor: "not-allowed",
        pointerEvents: "none",
    };

    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "220px 1fr",
                gap: 16,
                alignItems: "start",
            }}
        >
            {/* Sidebar */}
            <aside
                style={{
                    position: "sticky",
                    top: 16,
                    alignSelf: "start",
                    background: "#111",
                    border: "1px solid #262626",
                    borderRadius: 12,
                    padding: 12,
                }}
            >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontWeight: 700 }}>Admin</div>
                    <Link href="/" style={{ color: "#a0c4ff", textDecoration: "none", fontSize: 12 }}>
                        ← Site
                    </Link>
                </div>

                <div
                    style={{
                        fontSize: 12,
                        opacity: 0.85,
                        background: "#141414",
                        border: "1px solid #262626",
                        borderRadius: 8,
                        padding: "6px 8px",
                        marginBottom: 10,
                    }}
                >
                    {isAuthed ? "Signed in as admin" : "Not signed in"}
                </div>

                <nav style={{ display: "grid", gap: 6 }}>
                    <Link href="/admin" style={itemStyle}>
                        Overview
                    </Link>

                    <Link href="/admin/add" style={itemStyle}>
                        Add Game (IGDB)
                    </Link>

                    {/* Coming soon — placeholders to show the plan */}
                    <span style={disabledStyle} title="Coming soon">
            Manage Games
          </span>
                    <span style={disabledStyle} title="Coming soon">
            Files
          </span>
                    <span style={disabledStyle} title="Coming soon">
            Settings
          </span>

                    <div style={{ height: 1, background: "#1f1f1f", margin: "6px 0" }} />

                    {isAuthed ? (
                        <Link href="/admin/logout" style={itemStyle}>
                            Log out
                        </Link>
                    ) : (
                        <Link href="/admin/login" style={itemStyle}>
                            Log in
                        </Link>
                    )}
                </nav>
            </aside>

            {/* Admin content */}
            <section
                style={{
                    background: "#111",
                    border: "1px solid #262626",
                    borderRadius: 12,
                    padding: 16,
                    minHeight: 400,
                }}
            >
                {children}
            </section>
        </div>
    );
}
