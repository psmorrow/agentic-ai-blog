/**
 * Unit tests for HTML utilities.
 */

import { test } from "node:test";
import assert from "node:assert";
import {
  escapeHtml,
  extractMetadataFromHtml,
  extractTextForModeration,
  markdownToHtml
} from "./html.js";

test("escapeHtml", () => {
  assert.strictEqual(escapeHtml(""), "");
  assert.strictEqual(escapeHtml("<script>"), "&lt;script&gt;");
  assert.strictEqual(escapeHtml('"quotes"'), "&quot;quotes&quot;");
  assert.strictEqual(escapeHtml("a & b"), "a &amp; b");
});

test("extractMetadataFromHtml", () => {
  const html = `<!DOCTYPE html><html><head><title>Test Page</title>
<meta name="description" content="A sample description."></head><body>Body text</body></html>`;
  const meta = extractMetadataFromHtml(html);
  assert.strictEqual(meta.title, "Test Page");
  assert.strictEqual(meta.description, "A sample description.");
});

test("extractMetadataFromHtml empty input", () => {
  assert.deepStrictEqual(extractMetadataFromHtml(""), { title: "", description: "" });
  assert.deepStrictEqual(extractMetadataFromHtml(null), { title: "", description: "" });
});

test("extractMetadataFromHtml content-first meta", () => {
  const html = `<!DOCTYPE html><html><head><meta content="Content-first desc" name="description"></head></html>`;
  const meta = extractMetadataFromHtml(html);
  assert.strictEqual(meta.description, "Content-first desc");
});

test("extractTextForModeration", () => {
  const html = `<!DOCTYPE html><html><head><title>Test Page</title>
<meta name="description" content="A sample description."></head><body>Body text</body></html>`;
  const modText = extractTextForModeration(html, 500);
  assert.ok(modText.includes("Title: Test Page"));
  assert.ok(modText.includes("Description: A sample description."));
  assert.ok(modText.includes("Body text"));
});

test("extractTextForModeration empty input", () => {
  assert.strictEqual(extractTextForModeration("", 100), "");
  assert.strictEqual(extractTextForModeration(null, 100), "");
});

test("markdownToHtml converts markdown to HTML", () => {
  const md = "**Bold** and *italic* and `code`";
  const html = markdownToHtml(md);
  assert.ok(html.includes("<strong>Bold</strong>"));
  assert.ok(html.includes("<em>italic</em>"));
  assert.ok(html.includes("<code>code</code>"));
});

test("markdownToHtml sanitizes dangerous content", () => {
  const md = 'Plain text <script>alert(1)</script> and [link](https://example.com)';
  const html = markdownToHtml(md);
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("Plain text"));
  assert.ok(html.includes("<a "));
});

test("markdownToHtml empty input", () => {
  assert.strictEqual(markdownToHtml(""), "");
  assert.strictEqual(markdownToHtml(null), "");
});
