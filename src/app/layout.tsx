import Link from "next/link";

export const metadata = {
    title: "GameCubby",
    description: "Game collection manager"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
        <body
            style={{
                margin: 0,
                fontFamily: "system-ui, Arial, sans-serif",
                background: "#0b0b0b",
                color: "#eaeaea",
                minHeight: "100vh",
                display: "flex",
                flexDirection: "column"
            }}
        >
        {/* Top navigation */}
        <header
            style={{
                borderBottom: "1px solid #1f1f1f",
                background: "#111",
                position: "sticky",
                top: 0,
                zIndex: 10
            }}
        >
            <nav
                style={{
                    maxWidth: 1100,
                    margin: "0 auto",
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 16
                }}
            >
                <Link
                    href="/"
                    style={{
                        fontWeight: 700,
                        textDecoration: "none",
                        color: "#fff",
                        letterSpacing: 0.3
                    }}
                >
                    GameCubby
                </Link>

                <div style={{ display: "flex", gap: 12, marginLeft: 12 }}>
                    <Link href="/" style={linkStyle}>
                        Home
                    </Link>
                    <Link href="/games" style={linkStyle}>
                        Games
                    </Link>
                    <Link href="/search" style={linkStyle}>
                        Search
                    </Link>
                    <Link href="/admin" style={linkStyle}>
                        Admin
                    </Link>
                </div>
            </nav>
        </header>

        {/* Page content */}
        <main style={{ maxWidth: 1100, margin: "24px auto", padding: "0 16px", width: "100%" }}>
            {children}
        </main>

        {/* Footer (placeholder) */}
        <footer
            style={{
                marginTop: "auto",
                borderTop: "1px solid #1f1f1f",
                padding: "12px 16px",
                background: "#111",
                color: "#9a9a9a"
            }}
        >
            <div style={{ maxWidth: 1100, margin: "0 auto" }}>
                GameCubby Web UI — early scaffold
            </div>
        </footer>
        </body>
        </html>
    );
}

const linkStyle: React.CSSProperties = {
    color: "#d8d8d8",
    textDecoration: "none",
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid transparent"
};
