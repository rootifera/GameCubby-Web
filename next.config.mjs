/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    typedRoutes: true,
    // Headers that don't depend on the request. (The nonce-based Content-Security-Policy is set
    // per request in src/proxy.ts.) Cross-Origin-Embedder-Policy is deliberately NOT set: it would
    // block the external cover images the UI can show, and only matters for cross-origin isolation.
    async headers() {
        return [
            {
                source: "/:path*",
                headers: [
                    { key: "Permissions-Policy", value: "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=()" },
                    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
                    { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
                    { key: "X-Content-Type-Options", value: "nosniff" },
                ],
            },
        ];
    },
    outputFileTracingExcludes: {
        "/api/sentinel/restore/start": [
            "./Dockerfile",
            "./LICENSE",
            "./README.md",
            "./e2e/**/*",
            "./next.config.mjs",
            "./package-lock.json",
            "./package.json",
            "./playwright.config.ts",
            "./public/**/*",
            "./src/**/*",
            "./tsconfig.json"
        ]
    },
    turbopack: {
        ignoreIssue: [
            {
                path: /next\.config\.mjs$/,
                title: "Encountered unexpected file in NFT list"
            }
        ]
    }
};

export default nextConfig;
