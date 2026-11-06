import { expect, test } from "@playwright/test";

test("home shell renders brand and browse", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.ok()).toBeTruthy();
  await expect(page.getByRole("navigation").first()).toBeVisible();
  await expect(page.getByText("Flix").first()).toBeVisible();
});