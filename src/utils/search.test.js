/**
 * Unit tests for search utility.
 * Run: node --test src/utils/search.test.js
 */

import { test } from "node:test";
import assert from "node:assert";
import {
  buildArticleSearchQuery,
  searchArticles
} from "./search.js";

test("buildArticleSearchQuery without audience", () => {
  const q = buildArticleSearchQuery("What is photosynthesis?");
  assert.ok(q.includes("What is photosynthesis?"));
  assert.ok(q.includes("high quality"));
  assert.ok(q.includes("in-depth article"));
  assert.ok(!q.includes("for "));
});

test("buildArticleSearchQuery with audience", () => {
  const q = buildArticleSearchQuery("What is a camshaft?", "sixth grader, grade 6 reading level");
  assert.ok(q.includes("What is a camshaft?"));
  assert.ok(q.includes("high quality"));
  assert.ok(q.includes("for sixth grader, grade 6 reading level"));
});

test("searchArticles formats results as expected", async () => {
  const mockSerper = {
    search: async () => ({
      organic: [
        {
          title: "Test Article",
          link: "https://example.com/article",
          snippet: "A brief description."
        }
      ]
    })
  };

  const articles = await searchArticles(mockSerper, "test topic", null, 5);
  assert.strictEqual(typeof articles, "string");
  assert.ok(articles.includes("Test Article"));
  assert.ok(articles.includes("https://example.com/article"));
  assert.ok(articles.includes("A brief description"));
});

test("searchArticles filters results without link or title", async () => {
  const mockSerper = {
    search: async () => ({
      organic: [
        { title: "Good", link: "https://ok.com", snippet: "x" },
        { title: "", link: "https://missing-title.com", snippet: "x" },
        { title: "No link", link: "", snippet: "x" }
      ]
    })
  };

  const articles = await searchArticles(mockSerper, "topic");
  const lines = articles.trim().split("\n").filter(Boolean);
  assert.strictEqual(lines.length, 1);
  assert.ok(articles.includes("Good"));
});

test("searchArticles returns empty when organic is undefined", async () => {
  const mockSerper = { search: async () => ({}) };
  const articles = await searchArticles(mockSerper, "topic");
  assert.strictEqual(articles, "");
});

test("searchArticles returns empty when organic is null", async () => {
  const mockSerper = { search: async () => ({ organic: null }) };
  const articles = await searchArticles(mockSerper, "topic");
  assert.strictEqual(articles, "");
});

test("searchArticles omits suffix when snippet is undefined", async () => {
  const mockSerper = {
    search: async () => ({
      organic: [
        { title: "No Snippet", link: "https://example.com", snippet: undefined }
      ]
    })
  };
  const articles = await searchArticles(mockSerper, "topic");
  assert.strictEqual(articles, '"No Snippet" [https://example.com]');
});

test("searchArticles omits suffix when snippet is empty or whitespace", async () => {
  const mockSerper = {
    search: async () => ({
      organic: [
        { title: "Empty", link: "https://a.com", snippet: "" },
        { title: "Whitespace", link: "https://b.com", snippet: "   " }
      ]
    })
  };
  const articles = await searchArticles(mockSerper, "topic");
  assert.ok(articles.includes('"Empty" [https://a.com]'));
  assert.ok(articles.includes('"Whitespace" [https://b.com]'));
  assert.ok(!articles.includes(" - "));
});

test("searchArticles respects custom num parameter", async () => {
  const mockSerper = {
    search: async (opts) => {
      assert.strictEqual(opts.num, 3);
      return {
        organic: [
          { title: "A", link: "https://a.com", snippet: "a" },
          { title: "B", link: "https://b.com", snippet: "b" },
          { title: "C", link: "https://c.com", snippet: "c" }
        ]
      };
    }
  };
  const articles = await searchArticles(mockSerper, "topic", undefined, 3);
  const lines = articles.trim().split("\n").filter(Boolean);
  assert.strictEqual(lines.length, 3);
});

test("searchArticles uses default num when not provided", async () => {
  const mockSerper = {
    search: async (opts) => {
      assert.strictEqual(opts.num, 5);
      return { organic: [] };
    }
  };
  await searchArticles(mockSerper, "topic");
});
