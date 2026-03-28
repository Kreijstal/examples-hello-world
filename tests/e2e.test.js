import { test, expect } from "@playwright/test";

test.describe("KreijstalWiki static site", () => {
  test("home page loads and lists articles", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1.page-title")).toHaveText("Welcome to KreijstalWiki");
    await expect(page.locator("#article-list li")).toHaveCount(2, { timeout: 5000 });
    await expect(page.locator("#article-list")).toContainText("Deno");
    await expect(page.locator("#article-list")).toContainText("Hello World");
  });

  test("article page renders content", async ({ page }) => {
    await page.goto("/wiki/hello-world/");
    await expect(page.locator("h1#article-title")).toHaveText("Hello World");
    await expect(page.locator("#article-content")).toContainText("Hello, World!");
    const slug = await page.locator('meta[name="article-slug"]').getAttribute("content");
    expect(slug).toBe("hello-world");
  });

  test("deno article page renders", async ({ page }) => {
    await page.goto("/wiki/deno/");
    await expect(page.locator("h1#article-title")).toHaveText("Deno");
    await expect(page.locator("#article-content")).toContainText("runtime for JavaScript");
  });

  test("all articles page lists articles", async ({ page }) => {
    await page.goto("/all-articles/");
    await expect(page.locator("h1.page-title")).toHaveText("All Articles");
    await expect(page.locator(".article-list li")).toHaveCount(2);
  });

  test("search page works", async ({ page }) => {
    await page.goto("/search/");
    await expect(page.locator("h1.page-title")).toHaveText("Search");
    await page.waitForTimeout(500);
    await page.fill("#search-input", "deno");
    await expect(page.locator("#search-results li")).toHaveCount(1);
    await expect(page.locator("#search-results")).toContainText("Deno");
  });

  test("recent changes page loads", async ({ page }) => {
    await page.goto("/recent-changes/");
    await expect(page.locator("h1.page-title")).toHaveText("Recent Changes");
  });

  test("history page loads", async ({ page }) => {
    await page.goto("/wiki/hello-world/history/");
    await expect(page.locator("h1.page-title")).toContainText("History: Hello World");
  });

  test("sidebar navigation is present", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#sidebar")).toContainText("Main page");
    await expect(page.locator("#sidebar")).toContainText("All articles");
    await expect(page.locator("#sidebar")).toContainText("Recent changes");
    await expect(page.locator("#sidebar")).toContainText("Search");
  });

  test("header with logo and search is present", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#header .logo")).toContainText("KreijstalWiki");
    await expect(page.locator("#header-search input")).toBeVisible();
  });

  test("article page has tabs and edit works", async ({ page }) => {
    await page.goto("/wiki/deno/");
    await expect(page.locator("#tabs")).toContainText("Article");
    await expect(page.locator("#tabs")).toContainText("History");
    await expect(page.locator("#tabs")).toContainText("Edit");
    // Click edit tab
    await page.click("#edit-tab");
    await expect(page.locator("#edit-form")).toBeVisible();
    await expect(page.locator("#edit-textarea")).toBeVisible();
    // Cancel
    await page.click("#edit-form button:last-of-type");
    await expect(page.locator("#edit-form")).toBeHidden();
  });
});
