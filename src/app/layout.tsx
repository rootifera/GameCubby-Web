import Link from "next/link";
import NavBar from "@/components/NavBar";
import ApiStatus from "@/components/ApiStatus";
import AuthActions from "@/components/AuthActions";

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
            <style>{`html{scrollbar-gutter:stable;}*{box-sizing:border-box}
/* Remove spinner controls from number inputs */
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
}
input[type="number"] {
    -moz-appearance: textfield;
}
/* Prevent mouse wheel from changing number input values */
input[type="number"]:focus {
    outline: none;
}

.gc-mobile-lookup {
    display: none;
}

@media (max-width: 720px) {
    html {
        scrollbar-gutter: auto;
    }

    .gc-header {
        position: static !important;
    }

    .gc-api-status,
    .gc-auth-actions {
        display: none !important;
    }

    .gc-top-nav {
        max-width: none !important;
        padding: 10px 12px !important;
        gap: 10px !important;
        flex-wrap: wrap !important;
        align-items: center !important;
    }

    .gc-brand {
        width: 100% !important;
        font-size: 18px !important;
    }

    .gc-nav-links {
        margin-left: 0 !important;
        gap: 8px !important;
        width: 100% !important;
        overflow-x: auto !important;
        padding-bottom: 2px !important;
    }

    .gc-nav-links a {
        padding: 9px 12px !important;
        min-height: 38px !important;
    }

    .gc-main {
        max-width: none !important;
        margin: 12px auto !important;
        padding: 0 12px !important;
    }

    .gc-footer {
        display: none !important;
    }

    .gc-mobile-lookup {
        display: block !important;
        background: #111 !important;
        border: 1px solid #262626 !important;
        border-radius: 10px !important;
        padding: 12px !important;
        margin-bottom: 12px !important;
    }

    .gc-mobile-lookup-title {
        font-size: 13px !important;
        opacity: 0.82 !important;
        margin-bottom: 8px !important;
    }

    .gc-searchbox input,
    .gc-mobile-field {
        min-height: 44px !important;
        font-size: 16px !important;
        width: 100% !important;
        max-width: none !important;
    }

    .gc-searchbox button[type="submit"] {
        min-height: 44px !important;
        font-size: 15px !important;
    }

    .gc-search-form {
        display: grid !important;
        grid-template-columns: 1fr !important;
        gap: 12px !important;
        padding: 12px !important;
    }

    .gc-search-span,
    .gc-search-row,
    .gc-search-actions,
    .gc-search-size {
        grid-column: auto !important;
    }

    .gc-search-row {
        display: grid !important;
        grid-template-columns: 1fr !important;
        gap: 12px !important;
    }

    .gc-search-actions {
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 8px !important;
    }

    .gc-search-actions button {
        min-height: 44px !important;
        font-size: 15px !important;
    }

    .gc-result-item,
    .gc-game-list-item {
        align-items: flex-start !important;
        padding: 12px 0 !important;
    }

    .gc-result-info,
    .gc-game-list-info {
        grid-template-columns: 1fr !important;
        gap: 6px !important;
    }

    .gc-result-meta,
    .gc-game-list-meta {
        text-align: left !important;
        display: flex !important;
        gap: 10px !important;
        flex-wrap: wrap !important;
    }

    .gc-sort-bar {
        display: flex !important;
        gap: 8px !important;
        flex-wrap: wrap !important;
        overflow-x: visible !important;
        padding-bottom: 4px !important;
    }

    .gc-page-size-form {
        width: 100% !important;
        flex: 0 0 100% !important;
        margin-top: 4px !important;
    }

    .gc-pager {
        align-items: flex-start !important;
    }

    .gc-pager-links {
        width: 100% !important;
        overflow-x: auto !important;
        padding-bottom: 2px !important;
    }

    .gc-game-detail {
        display: grid !important;
        grid-template-columns: 1fr !important;
        gap: 12px !important;
        padding: 12px !important;
    }

    .gc-admin-actions {
        position: static !important;
        grid-row: 1 !important;
        justify-content: flex-start !important;
        flex-wrap: wrap !important;
    }

    .gc-game-cover img,
    .gc-game-cover > div {
        width: 128px !important;
        height: 172px !important;
        border-radius: 8px !important;
    }

    .gc-game-title {
        font-size: 22px !important;
        padding-right: 0 !important;
    }

    .gc-location-card {
        border-color: #3b82f6 !important;
        background: #101827 !important;
    }
}`}</style>
            <script dangerouslySetInnerHTML={{
                __html: `
                    // Disable mouse wheel on number inputs
                    document.addEventListener('DOMContentLoaded', function() {
                        function disableWheelOnNumberInputs() {
                            const numberInputs = document.querySelectorAll('input[type="number"]');
                            numberInputs.forEach(function(input) {
                                input.addEventListener('wheel', function(e) {
                                    e.preventDefault();
                                }, { passive: false });
                            });
                        }
                        
                        // Run on initial load
                        disableWheelOnNumberInputs();
                        
                        // Also handle dynamically added inputs (for React components)
                        const observer = new MutationObserver(function(mutations) {
                            mutations.forEach(function(mutation) {
                                if (mutation.addedNodes.length > 0) {
                                    disableWheelOnNumberInputs();
                                }
                            });
                        });
                        
                        observer.observe(document.body, {
                            childList: true,
                            subtree: true
                        });
                    });
                `
            }} />
            <link rel="icon" href="/favicon.ico" type="image/x-icon" />
        </head>
        <body
            style={{
                margin: 0,
                fontFamily: "system-ui, Arial, sans-serif",
                background: "#0b0b0b",
                color: "#eaeaea",
                minHeight: "100vh",
                display: "flex",
                flexDirection: "column",
            }}
        >
        {/* Top navigation */}
        <header
            className="gc-header"
            style={{
                borderBottom: "1px solid #1f1f1f",
                background: "#111",
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
                borderTop: "1px solid #1f1f1f",
                padding: "12px 16px",
                background: "#111",
                color: "#9a9a9a",
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
