/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    typedRoutes: true,
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
