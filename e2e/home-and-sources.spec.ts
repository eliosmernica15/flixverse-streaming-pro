import { expect, test } from "@playwright/test";
import { buildYapGridEmbedUrl } from "../src/lib/player/yapgrid";
import { buildStreamingSources } from "../src/lib/streamingSources";

test("home shell renders brand and browse", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.ok()).toBeTruthy();
  await expect(page.locator("nav")).toBeVisible();
  await expect(page.getByText("Flix").first()).toBeVisible();
});

test("yapgrid URLs use real server tokens, not short labels", () => {
  const url = buildYapGridEmbedUrl({
    movieId: 550,
    mediaType: "movie",
    server: "sg_g4",
    lang: "en",
    title: "Fight Club",
  });
  expect(url).toContain("https://yapgrid.com/embed/movie/550");
  expect(url).toContain("server=sg_g4");
  expect(url).toContain("lang=en");
  expect(url).toContain("autoplay=true");
  expect(url).not.toContain("server=z");
  expect(url).not.toContain("subtitle=");
});

// buildStreamingSources pins YapGrid LAST for every language: its audio
// track is upstream-controlled, so it must only be tried after every
// better-behaved provider. See streamingSources.ts.
test("default order: vidsrc first, yapgrid lanes last", () => {
  const en = buildStreamingSources(550, "movie");
  expect(en[0].id).toBe("vidsrc");
  expect(en[1].id).toBe("vidsrc-to");
  expect(en[2].id).toBe("videasy");
  const lastFour = en.slice(-4).map((s) => s.id);
  expect(lastFour).toEqual(["yapgrid-g", "yapgrid-x", "yapgrid-y", "yapgrid-z"]);
  expect(en.find((s) => s.id === "vidfast")?.url).not.toContain("sub=");
  expect(en.find((s) => s.id === "vidlink")?.url).not.toContain("lang=");
});

test("Albanian locale adds sq subtitle params; yapgrid stays last", () => {
  const sq = buildStreamingSources(550, "movie", undefined, undefined, { lang: "sq" });
  expect(sq[0].id).toBe("vidsrc");
  expect(sq[0].url).toContain("ds_lang=sq");
  expect(sq.find((s) => s.id === "vidfast")?.url).toContain("sub=sq");
  const lastFour = sq.slice(-4).map((s) => s.id);
  expect(lastFour).toEqual(["yapgrid-g", "yapgrid-x", "yapgrid-y", "yapgrid-z"]);
  expect(sq.every((s) => !s.url.includes("cc="))).toBeTruthy();
});
