/**
 * Unit tests for graph definition.
 * Run: node --test src/graph/graph.test.js
 */

import { test } from "node:test";
import assert from "node:assert";
import { createGraph, apiRetryPolicy } from "./graph.js";

const TEST_CONFIG = Object.freeze({
  OPENAI_API_KEY: "test-key",
  GOOGLE_SAFE_BROWSING_API_KEY: "test-key",
  SERPER_API_KEY: "test-key"
});

const mockSerper = {
  search: async () => ({
    organic: [
      { title: "Article 1", link: "https://example.com/1", snippet: "Desc 1" },
      { title: "Article 2", link: "https://example.com/2", snippet: "Desc 2" }
    ]
  })
};

const { retryOn } = apiRetryPolicy;

test("apiRetryPolicy.retryOn returns true for retryable HTTP status", () => {
  assert.strictEqual(retryOn({ status: 429 }), true);
  assert.strictEqual(retryOn({ status: 500 }), true);
  assert.strictEqual(retryOn({ status: 502 }), true);
  assert.strictEqual(retryOn({ status: 503 }), true);
});

test("apiRetryPolicy.retryOn returns true for status from response", () => {
  assert.strictEqual(retryOn({ response: { status: 502 } }), true);
  assert.strictEqual(retryOn({ response: { status: 503 } }), true);
});

test("apiRetryPolicy.retryOn returns true for retryable network codes", () => {
  assert.strictEqual(retryOn({ code: "ECONNRESET" }), true);
  assert.strictEqual(retryOn({ code: "ETIMEDOUT" }), true);
  assert.strictEqual(retryOn({ code: "ENOTFOUND" }), true);
});

test("apiRetryPolicy.retryOn returns true for code from cause", () => {
  assert.strictEqual(retryOn({ cause: { code: "ECONNRESET" } }), true);
  assert.strictEqual(retryOn({ cause: { code: "ETIMEDOUT" } }), true);
});

test("apiRetryPolicy.retryOn returns false for non-retryable status/code", () => {
  assert.strictEqual(retryOn({ status: 404 }), false);
  assert.strictEqual(retryOn({ status: 400 }), false);
  assert.strictEqual(retryOn({ code: "ERR_OTHER" }), false);
});

test("apiRetryPolicy.retryOn returns false for null/undefined", () => {
  assert.strictEqual(retryOn(null), false);
  assert.strictEqual(retryOn(undefined), false);
});

test("createGraph and invoke", async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    headers: new Headers({ "content-type": "text/html" }),
    text: async () =>
      "<!DOCTYPE html><html><head><title>Test</title></head><body>Body</body></html>"
  });

  try {
    const responses = [
      "Some answer",
      "QUESTION: What is X?\nANSWER: Some answer",
      "VERIFIED",
      "Topic A, Topic B, Topic C",
      '1. "Title" - Desc [Link](https://example.com)',
      "An image of X",
      "VERIFIED"
    ];
    let i = 0;
    const llm = {
      invoke: async () => ({ content: responses[i++ % responses.length] })
    };
    const openai = {
      moderations: { create: async () => ({ results: [{ flagged: false }] }) },
      images: {
        generate: async () => ({ data: [{ url: "https://example.com/img.png" }] })
      }
    };

    const graph = createGraph({
      llm,
      openai,
      config: TEST_CONFIG,
      serper: mockSerper
    });
    assert.strictEqual(typeof graph, "object");
    assert.strictEqual(typeof graph.invoke, "function");
    assert.strictEqual(typeof graph.stream, "function");

    const result = await graph.invoke(
      { userInput: "What is X?" },
      { streamMode: "values" }
    );
    assert.strictEqual(result?.userInput, "What is X?");
    assert.ok(result?.post);
    assert.strictEqual(typeof result?.post?.bodyHtml, "string");
    assert.ok(result?.post?.title?.includes("What is X?"));
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("createGraph with metricsCollector records node durations", async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    headers: new Headers({ "content-type": "text/html" }),
    text: async () =>
      "<!DOCTYPE html><html><head><title>Test</title></head><body>Body</body></html>"
  });

  const recorded = [];
  const metricsCollector = {
    recordNodeDuration(name, seconds) {
      recorded.push({ name, seconds });
    }
  };

  try {
    const responses = [
      "Some answer",
      "QUESTION: What is X?\nANSWER: Some answer",
      "VERIFIED",
      "Topic A, Topic B, Topic C",
      '1. "Title" - Desc [Link](https://example.com)',
      "An image of X",
      "VERIFIED"
    ];
    let i = 0;
    const llm = {
      invoke: async () => ({ content: responses[i++ % responses.length] })
    };
    const openai = {
      moderations: { create: async () => ({ results: [{ flagged: false }] }) },
      images: {
        generate: async () => ({ data: [{ url: "https://example.com/img.png" }] })
      }
    };

    const graph = createGraph({
      llm,
      openai,
      config: TEST_CONFIG,
      serper: mockSerper,
      metricsCollector
    });
    await graph.invoke({ userInput: "What is X?" }, { streamMode: "values" });

    assert.ok(recorded.length > 0, "recordNodeDuration should be called");
    const names = recorded.map((r) => r.name);
    assert.ok(names.includes("answerNode"), "answerNode should be recorded");
    assert.ok(
      recorded.every((r) => typeof r.seconds === "number"),
      "seconds should be numbers"
    );
  } finally {
    globalThis.fetch = origFetch;
  }
});
