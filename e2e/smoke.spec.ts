import { expect, test } from "@playwright/test";

const adminUsername = process.env.E2E_ADMIN_USERNAME ?? "e2e_admin";
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "e2e_admin_password";
const igdbClientId = process.env.E2E_IGDB_CLIENT_ID ?? "e2e_igdb_client_id";
const igdbClientSecret = process.env.E2E_IGDB_CLIENT_SECRET ?? "e2e_igdb_client_secret";

async function completeFirstRunIfNeeded(page: import("@playwright/test").Page) {
    const setupHeading = page.getByRole("heading", { name: "First Run Setup" });
    if (!(await setupHeading.isVisible().catch(() => false))) return;

    const alreadyDone = page.getByText("Setup is already completed.");
    if (await alreadyDone.isVisible().catch(() => false)) {
        await page.getByRole("link", { name: "Go to Home" }).click();
        await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
        return;
    }

    await page.getByLabel("Username").fill(adminUsername);
    await page.getByLabel("Password").fill(adminPassword);
    await page.getByLabel("Client ID").fill(igdbClientId);
    await page.getByLabel("Client Secret").fill(igdbClientSecret);
    await page.getByLabel("Query Limit").fill("100");
    await page.getByRole("button", { name: "Run Setup" }).click();

    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
}

test("public home page renders", async ({ page }) => {
    await page.goto("/");
    await completeFirstRunIfNeeded(page);

    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
});

test("admin login page renders", async ({ page }) => {
    await page.goto("/admin/login");

    await expect(page.getByRole("heading", { name: "Admin Login" })).toBeVisible();
    await expect(page.getByLabel("Username")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
});
