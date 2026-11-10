import { expect, test, describe } from "@playwright/test";

/**
 * Visual regression tests for 6 core routes at 390px (mobile) and 1440px (desktop).
 *
 * These tests capture screenshots of key pages and compare them against
 * baseline snapshots. Run with `npm run test:visual` to update snapshots.
 *
 * Routes tested:
 * 1. Home page (/)
 * 2. Browse page (/browse)
 * 3. Movie detail page (/movie/550)
 * 4. Plans page (/plans)
 * 5. Search page (/search)
 * 6. Profile page (/profile)
 */

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
];

const CORE_ROUTES = [
  { name: "home", path: "/" },
  { name: "browse", path: "/browse" },
  { name: "movie-detail", path: "/movie/550?type=movie" },
  { name: "plans", path: "/plans" },
  { name: "search", path: "/search?q=action" },
  { name: "profile", path: "/profile" },
];

for (const viewport of VIEWPORTS) {
  for (const route of CORE_ROUTES) {
    test.describe(`${route.name} @ ${viewport.name}`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      test(`${route.name} renders correctly`, async ({ page }) => {
        await page.goto(route.path, { waitUntil: "networkidle" });

        // Wait for any dynamic content to settle
        await page.waitForLoadState("domcontentloaded");
        await page.waitForTimeout(1000);

        // Hide any elements that cause flaky screenshots (animations, timestamps, etc.)
        await page.addStyleTag({
          content: `
            * {
              animation-duration: 0s !important;
              animation-delay: 0s !important;
              transition-duration: 0s !important;
              transition-delay: 0s !important;
              scroll-behavior: auto !important;
            }
            [data-testid="avatar"], [data-testid="user-menu"] {
              visibility: hidden !important;
            }
          `,
        });

        // Take screenshot
        await expect(page).toHaveScreenshot(`${route.name}-${viewport.name}.png`, {
          fullPage: true,
          maxDiffPixels: 100,
          threshold: 0.2,
        });
      });
    });
  }
}

// Additional test for authenticated pages (using a mock auth state)
test.describe("Authenticated pages visual regression", () => {
  for (const viewport of VIEWPORTS) {
    test.describe(`@ ${viewport.name}`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      test.beforeEach(async ({ page }) => {
        // Set up mock auth state via localStorage
        await page.goto("/", { waitUntil: "networkidle" });
        await page.evaluate(() => {
          localStorage.setItem("mockAuth", JSON.stringify({
            user: { uid: "test-user", email: "test@example.com", displayName: "Test User" },
            token: "mock-token",
          }));
        });
      });

      test("my-list page renders correctly", async ({ page }) => {
        await page.goto("/my-list", { waitUntil: "networkidle" });
        await page.waitForLoadState("domcontentloaded");
        await page.waitForTimeout(1000);

        await page.addStyleTag({
          content: `
            * {
              animation-duration: 0s !important;
              animation-delay: 0s !important;
              transition-duration: 0s !important;
              transition-delay: 0s !important;
            }
          `,
        });

        await expect(page).toHaveScreenshot(`my-list-${viewport.name}.png`, {
          fullPage: true,
          maxDiffPixels: 100,
          threshold: 0.2,
        });
      });

      test("party join page renders correctly", async ({ page }) => {
        await page.goto("/party/join?id=test-party-123", { waitUntil: "networkidle" });
        await page.waitForLoadState("domcontentloaded");
        await page.waitForTimeout(1000);

        await page.addStyleTag({
          content: `
            * {
              animation-duration: 0s !important;
              animation-delay: 0s !important;
              transition-duration: 0s !important;
              transition-delay: 0s !important;
            }
          `,
        });

        await expect(page).toHaveScreenshot(`party-join-${viewport.name}.png`, {
          fullPage: true,
          maxDiffPixels: 100,
          threshold: 0.2,
        });
      });
    });
  }
});

// Test dark/light mode variants for key pages
test.describe("Theme variants visual regression", () => {
  const THEMES = ["light", "dark"] as const;
  const KEY_ROUTES = [
    { name: "home", path: "/" },
    { name: "movie-detail", path: "/movie/550?type=movie" },
    { name: "plans", path: "/plans" },
  ];

  for (const theme of THEMES) {
    for (const route of KEY_ROUTES) {
      test.describe(`${route.name} @ ${theme} mode`, () => {
        test.use({ viewport: { width: 1440, height: 900 } });

        test(`${route.name} renders correctly in ${theme} mode`, async ({ page }) => {
          await page.goto("/", { waitUntil: "networkidle" });

          // Set theme via localStorage
          await page.evaluate((t) => {
            localStorage.setItem("theme", t);
            document.documentElement.classList.toggle("dark", t === "dark");
          }, theme);

          await page.goto(route.path, { waitUntil: "networkidle" });
          await page.waitForLoadState("domcontentloaded");
          await page.waitForTimeout(1000);

          await page.addStyleTag({
            content: `
              * {
                animation-duration: 0s !important;
                animation-delay: 0s !important;
                transition-duration: 0s !important;
                transition-delay: 0s !important;
              }
            `,
          });

          await expect(page).toHaveScreenshot(`${route.name}-${theme}.png`, {
            fullPage: true,
            maxDiffPixels: 100,
            threshold: 0.2,
          });
        });
      });
    }
  }
});