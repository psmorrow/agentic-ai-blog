/**
 * Unit tests for article utilities.
 */

import { test } from "node:test";
import assert from "node:assert";
import {
  extractUrlFromArticleLine,
  parseArticleLines,
  formatArticlesAsHtml
} from "./articles.js";

test("extractUrlFromArticleLine", () => {
  assert.strictEqual(
    extractUrlFromArticleLine('1. "Title" - Desc [Link](https://example.com)'),
    "https://example.com"
  );
  assert.strictEqual(
    extractUrlFromArticleLine('3. "With URL" - foo (https://other.org/page)'),
    "https://other.org/page"
  );
  assert.strictEqual(extractUrlFromArticleLine('2. "Title Two" - Desc2'), null);
  assert.strictEqual(extractUrlFromArticleLine(null), null);
  assert.strictEqual(extractUrlFromArticleLine(123), null);
  assert.strictEqual(extractUrlFromArticleLine("foo (https://bare.org)"), "https://bare.org");
  assert.strictEqual(extractUrlFromArticleLine("bar [https://bare.org]"), "https://bare.org");
});

test("parseArticleLines empty input", () => {
  assert.deepStrictEqual(parseArticleLines(""), []);
  assert.deepStrictEqual(parseArticleLines(null), []);
});

test("parseArticleLines", () => {
  const lines = `1. "Title One" - Desc [Link](https://example.com)
2. "Title Two" - Desc2
3. "With URL" - foo (https://other.org/page)`;
  const parsed = parseArticleLines(lines);
  assert.strictEqual(parsed.length, 2);
  assert.strictEqual(parsed[0].url, "https://example.com");
  assert.ok(parsed[0].line.includes("Title One"));
  assert.strictEqual(parsed[1].url, "https://other.org/page");
});

test("parseArticleLines skips invalid URL", () => {
  const lines = '1. "Title" - Desc [Link](https://[invalid::/)';
  const parsed = parseArticleLines(lines);
  assert.strictEqual(parsed.length, 0);
});

test("formatArticlesAsHtml", () => {
  const articles = `1. "Title One" - Desc [Link](https://example.com)
2. "Title Two" - Desc2`;
  const html = formatArticlesAsHtml(articles);
  assert.ok(html.includes("Title One"));
  assert.ok(html.includes("https://example.com"));
  assert.ok(html.includes("<li "));
});

test("formatArticlesAsHtml line without URL uses span", () => {
  const articles = '2. "Title Two" - Desc2';
  const html = formatArticlesAsHtml(articles);
  assert.ok(html.includes("<span>"));
  assert.ok(html.includes("Title Two"));
});

test("formatArticlesAsHtml line without title match uses fallback", () => {
  const articles = "3. Some text without quotes - more";
  const html = formatArticlesAsHtml(articles);
  assert.ok(html.includes("Some text"));
});

test("formatArticlesAsHtml empty input", () => {
  assert.strictEqual(formatArticlesAsHtml(""), "");
  assert.strictEqual(formatArticlesAsHtml(null), "");
});

test("formatArticlesAsHtml empty text fallback uses raw line", () => {
  const articles = "1. ";
  const html = formatArticlesAsHtml(articles);
  assert.ok(html.includes("1."));
});
