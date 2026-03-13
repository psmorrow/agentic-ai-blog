/**
 * Unit tests for graph index (createAgent).
 * Run: node --test src/graph/index.test.js
 * Tests for default llm/openai require OPENAI_API_KEY and GOOGLE_SAFE_BROWSING_API_KEY (e.g. from .env).
 */

import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert";
import { createAgent } from "./index.js";

const hasRequiredEnv =
  !!process.env.OPENAI_API_KEY?.trim() &&
  !!process.env.GOOGLE_SAFE_BROWSING_API_KEY?.trim() &&
  !!process.env.SERPER_API_KEY?.trim();

const TEST_CONFIG = Object.freeze({
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "test-key",
  GOOGLE_SAFE_BROWSING_API_KEY:
    process.env.GOOGLE_SAFE_BROWSING_API_KEY || "test-key",
  SERPER_API_KEY: process.env.SERPER_API_KEY || "test-key"
});

const mockSerper = {
  search: async () => ({
    organic: [
      { title: "Article 1", link: "https://example.com/1", snippet: "Desc 1" },
      { title: "Article 2", link: "https://example.com/2", snippet: "Desc 2" }
    ]
  })
};

test("createAgent with no options uses defaults", { skip: !hasRequiredEnv }, () => {
  const agent = createAgent();
  assert.strictEqual(typeof agent, "object");
  assert.strictEqual(typeof agent.invoke, "function");
  assert.strictEqual(typeof agent.stream, "function");
});

test("createAgent with llm only uses default openai", () => {
  const llm = { invoke: async () => ({ content: "x" }) };
  const agent = createAgent({ llm, config: TEST_CONFIG });
  assert.strictEqual(typeof agent, "object");
  assert.strictEqual(typeof agent.invoke, "function");
});

test("createAgent with openai only uses default llm", () => {
  const openai = {
    moderations: { create: async () => ({ results: [{}] }) },
    images: { generate: async () => ({ data: [] }) }
  };
  const agent = createAgent({ openai, config: TEST_CONFIG });
  assert.strictEqual(typeof agent, "object");
  assert.strictEqual(typeof agent.stream, "function");
});

test("createAgent and invoke", async () => {
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
      "QUESTION: What is Y?\nANSWER: Some answer",
      "VERIFIED",
      "Topic A, Topic B, Topic C",
      '1. "Title" - Desc [Link](https://example.com)',
      "An image of Y",
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

    const agent = createAgent({
      llm,
      openai,
      config: TEST_CONFIG,
      serper: mockSerper
    });
    assert.strictEqual(typeof agent, "object");
    assert.strictEqual(typeof agent.invoke, "function");
    assert.strictEqual(typeof agent.stream, "function");

    const result = await agent.invoke(
      { userInput: "What is Y?" },
      { streamMode: "values" }
    );
    assert.strictEqual(result?.userInput, "What is Y?");
    assert.ok(result?.post);
  } finally {
    globalThis.fetch = origFetch;
  }
});
