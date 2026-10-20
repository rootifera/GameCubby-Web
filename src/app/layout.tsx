import "./globals.css";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import ApiStatus from "@/components/ApiStatus";
import AuthActions from "@/components/AuthActions";
import NumberInputWheelGuard from "@/components/NumberInputWheelGuard";

export const metadata = {
    title: "GameCubby",
    description: "Game collection manager",
    icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
                                       children,
                                   }: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
        <head>

            <link rel="icon" href="/favicon.ico" type="image/x-icon" />
        </head>
        <body
            style={{
                margin: 0,
                fontFamily: "system-ui, Arial, sans-serif",
                background: "var(--gc-bg)",
                color: "var(--gc-text)",
                minHeight: "100vh",
                display: "flex",
                flexDirection: "column",
            }}
        >
        <NumberInputWheelGuard />
        {/* Top navigation */}
        <header
            className="gc-header"
            style={{
                borderBottom: "1px solid var(--gc-border-subtle)",
                background: "var(--gc-surface)",
                position: "sticky",
                top: 0,
                zIndex: 10,
            }}
        >
            {/* absolutely pin API status to the FAR RIGHT of the header */}
            <div
                className="gc-api-status"
                style={{
                    position: "absolute",
                    right: 20,
                    top: "50%",
                    transform: "translateY(-50%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 16, // fixed width so it never shifts layout
                    height: 16,
                }}
            >
                <ApiStatus />
            </div>

            <nav
                className="gc-top-nav"
                style={{
                    maxWidth: 1100,
                    margin: "0 auto",
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                }}
            >
                <Link
                    className="gc-brand"
                    href="/"
                    style={{
                        fontWeight: 700,
                        textDecoration: "none",
                        color: "#fff",
                        letterSpacing: 0.3,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                    }}
                >
                    <img
                        src="/favicon.ico"
                        alt="GameCubby Icon"
                        style={{
                            width: 24,
                            height: 24,
                            objectFit: "contain",
                        }}
                    />
                    GameCubby
                </Link>

                {/* Interactive nav items */}
                <NavBar />

                {/* spacer */}
                <div style={{ flex: 1 }} />

                {/* Auth actions on the right end of the container */}
                <AuthActions />
            </nav>
        </header>

        {/* Page content */}
        <main
            className="gc-main"
            style={{
                maxWidth: 1100,
                margin: "24px auto",
                padding: "0 16px",
                width: "100%",
            }}
        >
            {children}
        </main>

        {/* Footer */}
        <footer
            className="gc-footer"
            style={{
                marginTop: "auto",
                borderTop: "1px solid var(--gc-border-subtle)",
                padding: "12px 16px",
                background: "var(--gc-surface)",
                color: "var(--gc-muted)",
            }}
        >
            <div style={{ maxWidth: 1100, margin: "0 auto" }}>
                GameCubby Web UI
            </div>
        </footer>
        </body>
        </html>
    );
}
