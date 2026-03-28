import { test, expect } from "@playwright/test";

test.describe("FreeWiki static site", () => {
  test("home page loads and lists articles", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toHaveText("Welcome to FreeWiki");
    // Wait for search-index.json to load and populate the list
    await expect(page.locator("#article-list li")).toHaveCount(2, { timeout: 5000 });
    await expect(page.locator("#article-list")).toContainText("Deno");
    await expect(page.locator("#article-list")).toContainText("Hello World");
  });

  test("article page renders content", async ({ page }) => {
    await page.goto("/wiki/hello-world/");
    await expect(page.locator("h1")).toHaveText("Hello World");
    await expect(page.locator("#article-content")).toContainText("Hello, World!");
    // Check meta tags
    const slug = await page.locator('meta[name="article-slug"]').getAttribute("content");
    expect(slug).toBe("hello-world");
  });

  test("deno article page renders", async ({ page }) => {
    await page.goto("/wiki/deno/");
    await expect(page.locator("h1")).toHaveText("Deno");
    await expect(page.locator("#article-content")).toContainText("runtime for JavaScript");
  });

  test("all articles page lists articles", async ({ page }) => {
    await page.goto("/all-articles/");
    await expect(page.locator("h1")).toHaveText("All Articles");
    await expect(page.locator(".article-list li")).toHaveCount(2);
  });

  test("search page works", async ({ page }) => {
    await page.goto("/search/");
    await expect(page.locator("h1")).toHaveText("Search");
    // Wait for index to load
    await page.waitForTimeout(500);
    await page.fill("#search-input", "deno");
    await expect(page.locator("#search-results li")).toHaveCount(1);
    await expect(page.locator("#search-results")).toContainText("Deno");
  });

  test("recent changes page loads", async ({ page }) => {
    await page.goto("/recent-changes/");
    await expect(page.locator("h1")).toHaveText("Recent Changes");
  });

  test("history page loads", async ({ page }) => {
    await page.goto("/wiki/hello-world/history/");
    await expect(page.locator("h1")).toContainText("History: Hello World");
  });

  test("navigation links are present", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("nav")).toContainText("FreeWiki");
    await expect(page.locator("nav")).toContainText("All Articles");
    await expect(page.locator("nav")).toContainText("Recent Changes");
    await expect(page.locator("nav")).toContainText("Search");
  });

  test("edit button exists on article page", async ({ page }) => {
    await page.goto("/wiki/deno/");
    await expect(page.locator("#edit-btn")).toBeVisible();
    // Click edit and check form appears
    await page.click("#edit-btn");
    await expect(page.locator("#edit-form")).toBeVisible();
    await expect(page.locator("#edit-textarea")).toBeVisible();
    // Cancel edit
    await page.click("#edit-form button:last-of-type");
    await expect(page.locator("#edit-form")).toBeHidden();
  });
});
