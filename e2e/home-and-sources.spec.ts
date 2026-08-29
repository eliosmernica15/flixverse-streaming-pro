import { expect, test } from "@playwright/test";
import { buildYapGridEmbedUrl } from "../src/lib/player/yapgrid";
import { buildStreamingSources } from "../src/lib/streamingSources";

test("home shell renders brand and browse", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.ok()).toBeTruthy();
  await expect(page.locator("nav")).toBeVisible();
  await expect(page.getByText("Flix").first()).toBeVisible();
});

test("yapgrid URLs use documented server and lang params only", () => {
  const url = buildYapGridEmbedUrl({
    movieId: 550,
    mediaType: "movie",
    server: "z",
    lang: "sq",
    title: "Fight Club",
  });
  expect(url).toContain("https://yapgrid.com/embed/movie/550");
  expect(url).toContain("server=z");
  expect(url).toContain("lang=sq");
  expect(url).not.toContain("server=g");
  expect(url).not.toContain("subtitle=");
});

test("Albanian locale prepends YapGrid lanes and VidFast sub=sq", () => {
  const sq = buildStreamingSources(550, "movie", undefined, undefined, { lang: "sq" });
  expect(sq[0].id).toBe("yapgrid-z");
  expect(sq[1].id).toBe("yapgrid-x");
  expect(sq[2].id).toBe("yapgrid-y");
  const vidfast = sq.find((s) => s.id === "vidfast");
  expect(vidfast?.url).toContain("sub=sq");
  expect(sq.every((s) => !s.url.includes("cc="))).toBeTruthy();
});

test("non-Albanian does not shotgun subtitle params", () => {
  const en = buildStreamingSources(550, "movie");
  expect(en.some((s) => s.id.startsWith("yapgrid"))).toBeTruthy();
  expect(en.find((s) => s.id === "vidfast")?.url).not.toContain("sub=");
  expect(en.find((s) => s.id === "vidlink")?.url).not.toContain("lang=");
});
