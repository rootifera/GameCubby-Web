import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.WEBUI_E2E_PORT ?? 3100);
const baseURL = process.env.WEBUI_E2E_BASE_URL ?? `http://127.0.0.1:${port}`;
const chromiumExecutablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? "/usr/bin/chromium";
const shouldStartWebServer = !process.env.WEBUI_E2E_BASE_URL;

export default defineConfig({
    testDir: "./e2e",
    outputDir: "/tmp/gamecubby-web-playwright-results",
    timeout: 30_000,
    expect: {
        timeout: 10_000,
    },
    fullyParallel: false,
    workers: 1,
    reporter: [["list"]],
    use: {
        baseURL,
        trace: "retain-on-failure",
    },
    projects: [
        {
            name: "chromium",
            use: {
                ...devices["Desktop Chrome"],
                launchOptions: {
                    executablePath: chromiumExecutablePath,
                },
            },
        },
    ],
    webServer: shouldStartWebServer ? {
        command: `NEXT_PUBLIC_API_BASE_URL=${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:18080"} npm run start -- --hostname 127.0.0.1 --port ${port}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    } : undefined,
});
