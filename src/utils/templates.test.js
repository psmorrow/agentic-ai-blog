/**
 * Unit tests for templates (post fragments and page layouts).
 * Run: node --test src/utils/templates.test.js
 */

import { test } from "node:test";
import assert from "node:assert";
import {
  renderPostHtml,
  buildGaScript,
  renderEmptyFeedPage,
  renderFeedPage,
  renderFeedBlock,
  renderSinglePostPage
} from "./templates.js";

test("renderPostHtml returns empty string when post is null", () => {
  assert.strictEqual(renderPostHtml(null), "");
});

test("renderPostHtml returns empty string when slug is missing", () => {
  assert.strictEqual(renderPostHtml({ title: "X", bodyHtml: "<p>X</p>" }), "");
});

test("renderPostHtml returns empty string when title is missing", () => {
  assert.strictEqual(renderPostHtml({ slug: "x", bodyHtml: "<p>X</p>" }), "");
});

test("renderPostHtml renders minimal post", () => {
  const post = { slug: "what-is-x", title: "What is X?", bodyHtml: "<p>Content</p>" };
  const html = renderPostHtml(post);
  assert.ok(html.startsWith("<article"));
  assert.ok(html.includes('data-post-slug="what-is-x"'));
  assert.ok(html.includes("<h1"));
  assert.ok(html.includes("What is X?"));
  assert.ok(html.includes("<p>Content</p>"));
  assert.ok(!html.includes("<figure"));
  assert.ok(!html.includes("Further reading"));
});

test("renderPostHtml renders categories with primary and secondary styles", () => {
  const post = {
    slug: "x",
    title: "X",
    bodyHtml: "<p>B</p>",
    categories: ["Primary", "Secondary"]
  };
  const html = renderPostHtml(post);
  assert.ok(html.includes("bg-indigo-100"));
  assert.ok(html.includes("Primary"));
  assert.ok(html.includes("bg-slate-200"));
  assert.ok(html.includes("Secondary"));
});

test("renderPostHtml renders imageFilename as local path", () => {
  const post = {
    slug: "x",
    title: "X",
    bodyHtml: "<p>B</p>",
    imageFilename: "2026-01-01-x.png",
    imageAlt: "Illustration"
  };
  const html = renderPostHtml(post);
  assert.ok(html.includes("<figure"));
  assert.ok(html.includes('src="/posts/2026-01-01-x.png"'));
  assert.ok(html.includes('alt="Illustration"'));
});

test("renderPostHtml uses custom postsDir for imageFilename", () => {
  const post = {
    slug: "x",
    title: "X",
    bodyHtml: "<p>B</p>",
    imageFilename: "img.png"
  };
  const html = renderPostHtml(post, "assets");
  assert.ok(html.includes('src="/assets/img.png"'));
});

test("renderPostHtml renders imageUrl when imageFilename absent", () => {
  const post = {
    slug: "x",
    title: "X",
    bodyHtml: "<p>B</p>",
    imageUrl: "https://example.com/img.png"
  };
  const html = renderPostHtml(post);
  assert.ok(html.includes("<figure"));
  assert.ok(html.includes('src="https://example.com/img.png"'));
});

test("renderPostHtml renders Further reading section with articles", () => {
  const post = {
    slug: "x",
    title: "X",
    bodyHtml: "<p>B</p>",
    articles: [
      { title: "Link 1", url: "https://a.com" },
      { title: "Link 2", url: "https://b.com" }
    ]
  };
  const html = renderPostHtml(post);
  assert.ok(html.includes("Further reading"));
  assert.ok(html.includes('href="https://a.com"'));
  assert.ok(html.includes("Link 1"));
  assert.ok(html.includes('data-article-url="https://a.com"'));
  assert.ok(html.includes("Link 2"));
});

test("renderPostHtml escapes HTML in title and slug", () => {
  const post = {
    slug: 'x" onclick="alert(1)',
    title: "<script>evil</script>",
    bodyHtml: "<p>Safe</p>"
  };
  const html = renderPostHtml(post);
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("&quot;"));
});

test("buildGaScript returns empty string when gaId is falsy", () => {
  assert.strictEqual(buildGaScript(""), "");
  assert.strictEqual(buildGaScript(null), "");
});

test("buildGaScript returns script when gaId is set", () => {
  const script = buildGaScript("G-XXXX");
  assert.ok(script.includes("googletagmanager.com"));
  assert.ok(script.includes("page_view"));
  assert.ok(script.includes("G-XXXX"));
});

test("renderEmptyFeedPage includes title and No posts yet", () => {
  const html = renderEmptyFeedPage({ gaScript: "" });
  assert.ok(html.startsWith("<!DOCTYPE html"));
  assert.ok(html.includes("<title>Agentic AI Blog</title>"));
  assert.ok(html.includes("No posts yet"));
});

test("renderFeedPage includes blocks", () => {
  const html = renderFeedPage({ blocks: ["<div>Block 1</div>", "<div>Block 2</div>"], gaScript: "" });
  assert.ok(html.includes("<div>Block 1</div>"));
  assert.ok(html.includes("<div>Block 2</div>"));
});

test("renderFeedBlock escapes label and joins fragments", () => {
  const block = renderFeedBlock({ label: "Today", fragments: ["<article>A</article>", "<article>B</article>"] });
  assert.ok(block.includes("Today"));
  assert.ok(block.includes("<article>A</article>"));
  assert.ok(block.includes("<article>B</article>"));
});

test("renderSinglePostPage escapes dateLabel and includes fragment", () => {
  const html = renderSinglePostPage({
    dateLabel: "<script>bad</script>",
    fragment: "<article>Post</article>",
    gaScript: ""
  });
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("<article>Post</article>"));
  assert.ok(html.includes("<title>Agentic AI Post</title>"));
});
