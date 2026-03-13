/**
 * E2E tests: routes, JSON API, and rendering.
 * Run: npm run test:e2e
 * Requires: server starts via webServer (or run `npm run server` first).
 */

import { test, expect } from "@playwright/test";

test.describe("Routes", () => {
  test("GET / returns 200", async ({ request }) => {
    const res = await request.get("/");
    expect(res.status()).toBe(200);
  });

  test("GET /v1/posts returns 200", async ({ request }) => {
    const res = await request.get("/v1/posts");
    expect(res.status()).toBe(200);
  });

  test("GET /posts/:slug returns 200 for valid slug", async ({ request }) => {
    const res = await request.get("/posts/what-is-electricity");
    expect(res.status()).toBe(200);
  });

  test("GET /posts/:slug returns 404 for nonexistent slug", async ({ request }) => {
    const res = await request.get("/posts/nonexistent-slug-xyz");
    expect(res.status()).toBe(404);
  });

  test("GET /posts/*.png returns 200 for static image", async ({ request }) => {
    const res = await request.get("/posts/2026-03-12T20-03-43-what-is-electricity.png");
    expect(res.status()).toBe(200);
  });
});

test.describe("JSON API", () => {
  test("/v1/posts returns valid JSON with posts array", async ({ request }) => {
    const res = await request.get("/v1/posts");
    const data = await res.json();
    expect(data).toHaveProperty("posts");
    expect(Array.isArray(data.posts)).toBe(true);
    data.posts.forEach((p) => {
      expect(typeof p).toBe("string");
      expect(p.endsWith(".json")).toBe(true);
    });
  });

  test("/v1/posts returns posts in chronological order (latest first)", async ({ request }) => {
    const res = await request.get("/v1/posts");
    const { posts } = await res.json();
    if (posts.length < 2) return;
    for (let i = 1; i < posts.length; i++) {
      expect(posts[i].localeCompare(posts[i - 1])).toBeLessThanOrEqual(0);
    }
  });
});

test.describe("Feed rendering", () => {
  test("feed has correct title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("Agentic AI Blog");
  });

  test("feed has main landmark and h1", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Agentic AI Blog" })).toBeVisible();
  });

  test("feed contains articles with data-post-slug", async ({ page }) => {
    await page.goto("/");
    const articles = page.locator("article");
    await expect(articles.first()).toBeVisible();
    const count = await page.locator("[data-post-slug]").count();
    expect(count).toBeGreaterThan(0);
  });

  test("feed articles have images with alt text", async ({ page }) => {
    await page.goto("/");
    const imgs = page.locator("article figure img");
    const count = await imgs.count();
    if (count > 0) {
      const alt = await imgs.first().getAttribute("alt");
      expect(alt).toBeTruthy();
    }
  });
});

test.describe("Single post rendering", () => {
  test("single post has correct title", async ({ page }) => {
    await page.goto("/posts/what-is-electricity");
    await expect(page).toHaveTitle("Agentic AI Post");
  });

  test("single post has heading and article content", async ({ page }) => {
    await page.goto("/posts/what-is-electricity");
    await expect(page.getByRole("heading", { level: 1, name: "Agentic AI Post" })).toBeVisible();
    await expect(page.locator("article")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "What is electricity?" })).toBeVisible();
  });

  test("single post has figure with image", async ({ page }) => {
    await page.goto("/posts/what-is-electricity");
    const figure = page.locator("article figure img");
    await expect(figure).toBeVisible();
    const src = await figure.getAttribute("src");
    expect(src).toMatch(/\/posts\/.*\.png/);
    const alt = await figure.getAttribute("alt");
    expect(alt).toBeTruthy();
  });

  test("single post has Further reading section when articles exist", async ({ page }) => {
    await page.goto("/posts/what-is-electricity");
    await expect(page.getByRole("heading", { level: 2, name: "Further reading" })).toBeVisible();
    const links = page.locator("#further-reading a[href^='http']");
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
  });
});
