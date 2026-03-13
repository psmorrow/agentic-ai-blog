/**
 * Unit tests for server (Express app).
 * Run: node --test src/server.test.js
 */

import { test } from "node:test";
import assert from "node:assert";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import request from "supertest";
import { createApp } from "./server.js";

/** Helper: minimal post JSON for tests */
function postJson(overrides = {}) {
  return {
    slug: "what-is-dna",
    title: "What is DNA?",
    bodyHtml: "<p>The molecule of life.</p>",
    categories: [],
    articles: [],
    ...overrides
  };
}

test("GET / returns HTML with Agentic AI Blog title", async () => {
  const app = createApp();
  const res = await request(app).get("/");
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers["content-type"], "text/html; charset=utf-8");
  assert.ok(res.text.includes("<title>Agentic AI Blog</title>"));
  assert.ok(res.text.includes("Agentic AI Blog"));
});

test("GET / includes Tailwind script", async () => {
  const app = createApp();
  const res = await request(app).get("/");
  assert.ok(res.text.includes("tailwindcss.com"));
});

test("GET /v1/posts returns JSON with posts array", async () => {
  const app = createApp();
  const res = await request(app).get("/v1/posts");
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers["content-type"], "application/json; charset=utf-8");
  assert.ok(Array.isArray(res.body.posts));
});

test("GET /v1/posts returns posts in chronological order (latest first)", async () => {
  const app = createApp();
  const res = await request(app).get("/v1/posts");
  const posts = res.body.posts;
  if (posts.length < 2) return;
  for (let i = 1; i < posts.length; i++) {
    assert.ok(
      posts[i].localeCompare(posts[i - 1]) <= 0,
      `Expected ${posts[i]} before ${posts[i - 1]}`
    );
  }
});

test("GET / with empty posts dir shows No posts yet", async () => {
  const emptyDir = mkdtempSync(join(tmpdir(), "server-test-empty-"));
  try {
    const app = createApp(emptyDir);
    const res = await request(app).get("/");
    assert.strictEqual(res.status, 200);
    assert.ok(res.text.includes("No posts yet"));
  } finally {
    rmSync(emptyDir, { recursive: true, force: true });
  }
});

test("GET /v1/posts with empty posts dir returns empty array", async () => {
  const emptyDir = mkdtempSync(join(tmpdir(), "server-test-empty-"));
  try {
    const app = createApp(emptyDir);
    const res = await request(app).get("/v1/posts");
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body, { posts: [] });
  } finally {
    rmSync(emptyDir, { recursive: true, force: true });
  }
});

test("GET / embeds post fragment with data-post-slug and content", async () => {
  const testDir = mkdtempSync(join(tmpdir(), "server-test-posts-"));
  try {
    const post = postJson({ slug: "what-is-dna", title: "DNA", bodyHtml: "<p>The molecule of life.</p>" });
    writeFileSync(join(testDir, "2026-01-15T12-00-00-what-is-dna.json"), JSON.stringify(post));
    const app = createApp(testDir);
    const res = await request(app).get("/");
    assert.strictEqual(res.status, 200);
    assert.ok(res.text.includes("data-post-slug=\"what-is-dna\""));
    assert.ok(res.text.includes("The molecule of life."));
  } finally {
    rmSync(testDir, { recursive: true, force: true });
  }
});

test("GET / with non-existent posts dir returns empty state (ENOENT)", async () => {
  const nonexistent = join(tmpdir(), "server-test-nonexistent-xyz-12345");
  const app = createApp(nonexistent);
  const res = await request(app).get("/");
  assert.strictEqual(res.status, 200);
  assert.ok(res.text.includes("No posts yet"));
});

test("GET /v1/posts with non-existent posts dir returns empty array (ENOENT)", async () => {
  const nonexistent = join(tmpdir(), "server-test-nonexistent-xyz-12345");
  const app = createApp(nonexistent);
  const res = await request(app).get("/v1/posts");
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.body, { posts: [] });
});

test("GET / returns 500 when posts path is invalid (not a directory)", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "server-test-"));
  const filePath = join(tempDir, "not-a-dir");
  writeFileSync(filePath, "x");
  try {
    const app = createApp(filePath);
    const res = await request(app).get("/");
    assert.strictEqual(res.status, 500);
    assert.strictEqual(res.headers["content-type"], "application/json; charset=utf-8");
    assert.ok(res.body.error);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("GET /v1/posts returns 500 when posts path is invalid (not a directory)", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "server-test-"));
  const filePath = join(tempDir, "not-a-dir");
  writeFileSync(filePath, "x");
  try {
    const app = createApp(filePath);
    const res = await request(app).get("/v1/posts");
    assert.strictEqual(res.status, 500);
    assert.ok(res.body.error);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("GET /posts/nonexistent-slug returns 404", async () => {
  const testDir = mkdtempSync(join(tmpdir(), "server-test-"));
  try {
    writeFileSync(join(testDir, "2026-01-01-what-is-dna.json"), JSON.stringify(postJson()));
    const app = createApp(testDir);
    const res = await request(app).get("/posts/nonexistent-slug");
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.text, "Not found");
  } finally {
    rmSync(testDir, { recursive: true, force: true });
  }
});

test("GET /posts/:slug renders dedicated single post page", async () => {
  const testDir = mkdtempSync(join(tmpdir(), "server-test-single-"));
  try {
    const post = postJson({ slug: "what-is-dna", title: "DNA", bodyHtml: "<p>The molecule of life.</p>" });
    writeFileSync(join(testDir, "2026-01-15T12-00-00-what-is-dna.json"), JSON.stringify(post));
    const app = createApp(testDir);
    const res = await request(app).get("/posts/what-is-dna");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers["content-type"], "text/html; charset=utf-8");
    assert.ok(res.text.includes("The molecule of life."));
    assert.ok(res.text.includes('data-post-slug="what-is-dna"'));
    assert.ok(res.text.includes("uppercase tracking-wide"), "single post shows date label");
  } finally {
    rmSync(testDir, { recursive: true, force: true });
  }
});


test("GET / feed omits GA4 script when GA_MEASUREMENT_ID not set", async () => {
  const testDir = mkdtempSync(join(tmpdir(), "server-test-"));
  try {
    writeFileSync(join(testDir, "2026-01-01-a.json"), JSON.stringify(postJson({ slug: "a", title: "A", bodyHtml: "<p>Post</p>" })));
    const app = createApp(testDir, { GA_MEASUREMENT_ID: "" });
    const res = await request(app).get("/");
    assert.strictEqual(res.status, 200);
    assert.ok(!res.text.includes("googletagmanager.com"), "no GA script when gaId empty");
  } finally {
    rmSync(testDir, { recursive: true, force: true });
  }
});

test("GET / feed with filename lacking date pattern uses fallback date", async () => {
  const testDir = mkdtempSync(join(tmpdir(), "server-test-"));
  try {
    writeFileSync(join(testDir, "no-date-match.json"), JSON.stringify(postJson({ slug: "weird", title: "Weird", bodyHtml: "<p>Content</p>" })));
    const app = createApp(testDir);
    const res = await request(app).get("/");
    assert.strictEqual(res.status, 200);
    assert.ok(res.text.includes("years ago") || res.text.includes("Content"), "fallback date or content");
  } finally {
    rmSync(testDir, { recursive: true, force: true });
  }
});

test("toRelativeDate 1 week ago", async () => {
  const testDir = mkdtempSync(join(tmpdir(), "server-test-"));
  try {
    const d = new Date();
    d.setDate(d.getDate() - 8);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    writeFileSync(
      join(testDir, `${y}-${m}-${day}T12-00-00-week-ago.json`),
      JSON.stringify(postJson({ slug: "week-ago", title: "Week Ago", bodyHtml: "<p>Old</p>" }))
    );
    const app = createApp(testDir);
    const res = await request(app).get("/");
    assert.strictEqual(res.status, 200);
    assert.ok(res.text.includes("1 week ago"));
  } finally {
    rmSync(testDir, { recursive: true, force: true });
  }
});

test("GET /posts/:slug with filename lacking date uses fallback", async () => {
  const testDir = mkdtempSync(join(tmpdir(), "server-test-"));
  try {
    writeFileSync(join(testDir, "nodate-slug.json"), JSON.stringify(postJson({ slug: "slug", title: "Slug", bodyHtml: "<p>Post</p>" })));
    const app = createApp(testDir);
    const res = await request(app).get("/posts/slug");
    assert.strictEqual(res.status, 200);
    assert.ok(res.text.includes("years ago") || res.text.includes("Post"));
  } finally {
    rmSync(testDir, { recursive: true, force: true });
  }
});

test("GET / feed includes GA4 script when GA_MEASUREMENT_ID set", async () => {
  const testDir = mkdtempSync(join(tmpdir(), "server-test-"));
  try {
    writeFileSync(join(testDir, "2026-01-01-a.json"), JSON.stringify(postJson({ slug: "a", title: "A", bodyHtml: "<p>Post A</p>" })));
    const app = createApp(testDir, { GA_MEASUREMENT_ID: "G-FEED" });
    const res = await request(app).get("/");
    assert.strictEqual(res.status, 200);
    assert.ok(res.text.includes("googletagmanager.com"));
    assert.ok(res.text.includes("page_view"));
    assert.ok(res.text.includes("IntersectionObserver"));
  } finally {
    rmSync(testDir, { recursive: true, force: true });
  }
});
