/**
 * Unit tests for graph nodes.
 * Run: node --test src/graph/nodes.test.js
 */

import { test } from "node:test";
import assert from "node:assert";
import { logger } from "../utils/logger.js";
import { createNodes } from "./nodes.js";
import { renderPostHtml } from "../utils/templates.js";

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

const mockLlm = {
  invoke: async () => ({ content: "Mocked response" })
};

const mockOpenai = {
  moderations: {
    create: async () => ({ results: [{ flagged: false }] })
  },
  images: {
    generate: async () => ({
      data: [{ url: "https://example.com/image.png" }]
    })
  }
};

test("answerNode", async () => {
  const nodes = createNodes({
      llm: mockLlm,
      openai: mockOpenai,
      config: TEST_CONFIG,
      serper: mockSerper
    });
  const r = await nodes.answerNode({ userInput: "What is X?" });
  assert.ok(r.finalAnswer?.includes("Question: What is X?"));
  assert.ok(r.finalAnswer?.includes("Answer: Mocked response"));
});

test("answerNode with audience", async () => {
  const nodes = createNodes({
    llm: mockLlm,
    openai: mockOpenai,
    config: TEST_CONFIG,
    serper: mockSerper
  });
  const r = await nodes.answerNode({ userInput: "What is X?", audience: "student, grade 8" });
  assert.ok(r.finalAnswer?.includes("Mocked response"));
});

test("editorNode", async () => {
  const content = "QUESTION: Edited Q?\nANSWER: Edited A.";
  const llm = { invoke: async () => ({ content }) };
  const nodes = createNodes({ llm, openai: mockOpenai, config: TEST_CONFIG, serper: mockSerper });
  const r = await nodes.editorNode({
    userInput: "Original Q",
    finalAnswer: "Question: Original Q\n\nAnswer: Original A"
  });
  assert.strictEqual(r.userInput, "Edited Q?");
  assert.ok(r.finalAnswer?.includes("Edited A."));
});

test("verifyNode VERIFIED", async () => {
  const llm = { invoke: async () => ({ content: "VERIFIED" }) };
  const nodes = createNodes({ llm, openai: mockOpenai, config: TEST_CONFIG, serper: mockSerper });
  const r = await nodes.verifyNode({
    userInput: "Q",
    finalAnswer: "Question: Q\n\nAnswer: A"
  });
  assert.strictEqual(r.verified, true);
});

test("verifyNode REJECTED returns verified false and logs category with reason", async () => {
  const llm = { invoke: async () => ({ content: "REJECTED: ACCURACY: Not accurate enough" }) };
  const errorCalls = [];
  const originalError = logger.error;
  logger.error = (...args) => { errorCalls.push(args); };
  try {
    const nodes = createNodes({ llm, openai: mockOpenai, config: TEST_CONFIG, serper: mockSerper });
    const r = await nodes.verifyNode({ userInput: "Q", finalAnswer: "A" });
    assert.strictEqual(r.verified, false);
    assert.strictEqual(r.rejectionReason, "Answer could not be verified.");
    assert.strictEqual(errorCalls.length, 1);
    assert.ok(errorCalls[0][0].includes("ACCURACY"));
    assert.ok(errorCalls[0][1].includes("Not accurate enough"));
  } finally {
    logger.error = originalError;
  }
});

test("verifyNode REJECTED legacy format without category returns verified false", async () => {
  const llm = { invoke: async () => ({ content: "REJECTED: Something went wrong" }) };
  const errorCalls = [];
  const originalError = logger.error;
  logger.error = (...args) => { errorCalls.push(args); };
  try {
    const nodes = createNodes({ llm, openai: mockOpenai, config: TEST_CONFIG, serper: mockSerper });
    const r = await nodes.verifyNode({ userInput: "Q", finalAnswer: "A" });
    assert.strictEqual(r.verified, false);
    assert.strictEqual(r.rejectionReason, "Answer could not be verified.");
    assert.strictEqual(errorCalls.length, 1);
    assert.ok(errorCalls[0][0].includes("UNKNOWN"));
    assert.ok(errorCalls[0][1].includes("Something went wrong"));
  } finally {
    logger.error = originalError;
  }
});

test("categorizeNode", async () => {
  const llm = { invoke: async () => ({ content: "Topic A, Topic B, Topic C" }) };
  const nodes = createNodes({ llm, openai: mockOpenai, config: TEST_CONFIG, serper: mockSerper });
  const r = await nodes.categorizeNode({ userInput: "Q", finalAnswer: "A" });
  assert.ok(Array.isArray(r.categories));
  assert.strictEqual(r.categories?.length, 3);
});

test("articlesNode", async () => {
  const nodes = createNodes({
    llm: mockLlm,
    openai: mockOpenai,
    config: TEST_CONFIG,
    serper: mockSerper
  });
  const r = await nodes.articlesNode({ userInput: "Q" });
  assert.strictEqual(typeof r.articles, "string");
  assert.ok(r.articles.includes("Article 1"));
  assert.ok(r.articles.includes("https://example.com/1"));
});

test("validateImageNode no image", async () => {
  const nodes = createNodes({
      llm: mockLlm,
      openai: mockOpenai,
      config: TEST_CONFIG,
      serper: mockSerper
    });
  const r = await nodes.validateImageNode({ imageUrl: null });
  assert.strictEqual(Object.keys(r).length, 0);
});

test("validateArticlesNode throws when GOOGLE_SAFE_BROWSING_API_KEY not set", async () => {
  const nodes = createNodes({
    llm: mockLlm,
    openai: mockOpenai,
    config: {
      OPENAI_API_KEY: "test",
      GOOGLE_SAFE_BROWSING_API_KEY: "",
      SERPER_API_KEY: "test"
    },
    serper: mockSerper
  });
  await assert.rejects(
    () =>
      nodes.validateArticlesNode({
        articles: '1. "Title" - Desc [Link](https://example.com)'
      }),
    /GOOGLE_SAFE_BROWSING_API_KEY/
  );
});

test("validateArticlesNode catch skips article on fetch error", async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("Network error");
  };

  try {
    const nodes = createNodes({
      llm: mockLlm,
      openai: mockOpenai,
      config: TEST_CONFIG,
      serper: mockSerper
    });
    const origErr = logger.error;
    logger.error = () => {};

    const r = await nodes.validateArticlesNode({
      articles: '1. "Title" - Desc [Link](https://example.com)'
    });

    logger.error = origErr;
    assert.strictEqual(r.articles, "");
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("validateImageNode moderation error excludes image", async () => {
  const openai = {
    moderations: {
      create: async () => {
        throw new Error("API error");
      }
    }
  };
  const nodes = createNodes({ llm: mockLlm, openai, config: TEST_CONFIG, serper: mockSerper });
  const orig = logger.error;
  logger.error = () => {};
  const r = await nodes.validateImageNode({
    imageUrl: "https://example.com/img.png"
  });
  logger.error = orig;
  assert.strictEqual(r.imageUrl, null);
});

test("validateImageNode flagged", async () => {
  const openai = {
    moderations: { create: async () => ({ results: [{ flagged: true }] }) }
  };
  const nodes = createNodes({ llm: mockLlm, openai, config: TEST_CONFIG, serper: mockSerper });
  const orig = logger.error;
  logger.error = () => {};
  const r = await nodes.validateImageNode({
    imageUrl: "https://example.com/img.png"
  });
  logger.error = orig;
  assert.strictEqual(r.imageUrl, null);
});

test("outputNode", async () => {
  const nodes = createNodes({
      llm: mockLlm,
      openai: mockOpenai,
      config: TEST_CONFIG,
      serper: mockSerper
    });
  const r = await nodes.outputNode({
    userInput: "What is X?",
    finalAnswer: "Question: What is X?\n\nAnswer: The answer body.",
    articles: '1. "Title" - Desc [Link](https://example.com)',
    categories: ["Topic A", "Topic B"],
    imageUrl: "https://example.com/img.png"
  });
  assert.ok(r.post);
  assert.strictEqual(r.post.slug, "what-is-x");
  assert.strictEqual(r.post.title, "What is X?");
  assert.ok(r.post.bodyHtml?.includes("The answer body."));
  assert.deepStrictEqual(r.post.categories, ["Topic A", "Topic B"]);
  assert.ok(r.post.articles?.length > 0);
  assert.strictEqual(r.post.imageUrl, "https://example.com/img.png");
  const html = renderPostHtml(r.post);
  assert.ok(html.includes("Further reading"));
  assert.ok(html.includes("<figure"));
});

test("outputNode emits fragment with data-post-slug and data-article-url for GA4", async () => {
  const nodes = createNodes({
    llm: mockLlm,
    openai: mockOpenai,
    config: TEST_CONFIG,
    serper: mockSerper
  });
  const r = await nodes.outputNode({
    userInput: "What is X?",
    finalAnswer: "Question: What is X?\n\nAnswer: A.",
    articles: '1. "Title" - Desc [Link](https://example.com)',
    categories: [],
    imageUrl: null
  });
  const html = renderPostHtml(r.post);
  assert.ok(html.startsWith("<article"));
  assert.ok(html.includes('data-post-slug="what-is-x"'));
  assert.ok(html.includes("data-article-url"));
  assert.ok(!html.includes("<!DOCTYPE"));
  assert.ok(!html.includes("googletagmanager"));
});

test("outputNode without image", async () => {
  const nodes = createNodes({
      llm: mockLlm,
      openai: mockOpenai,
      config: TEST_CONFIG,
      serper: mockSerper
    });
  const r = await nodes.outputNode({
    userInput: "Q",
    finalAnswer: "Question: Q\n\nAnswer: A",
    articles: "",
    categories: [],
    imageUrl: null
  });
  assert.ok(!r.post.imageUrl);
  const html = renderPostHtml(r.post);
  assert.ok(!html.includes("<figure"));
  assert.ok(!html.includes("Further reading"));
});

test("outputNode without articles hides Further reading section", async () => {
  const nodes = createNodes({
    llm: mockLlm,
    openai: mockOpenai,
    config: TEST_CONFIG,
    serper: mockSerper
  });
  const r = await nodes.outputNode({
    userInput: "Q",
    finalAnswer: "Question: Q\n\nAnswer: A",
    articles: "",
    categories: ["Topic"],
    imageUrl: null
  });
  const html = renderPostHtml(r.post);
  assert.ok(!html.includes("Further reading"));
  assert.ok(html.includes("Topic"));
});

test("validateArticlesNode logs when no articles to validate", async () => {
  const nodes = createNodes({
    llm: mockLlm,
    openai: mockOpenai,
    config: TEST_CONFIG,
    serper: mockSerper
  });
  let logMessage;
  const orig = logger.error;
  logger.error = (...args) => {
    logMessage = args.join(" ");
  };
  const r = await nodes.validateArticlesNode({ articles: "no valid urls here" });
  logger.error = orig;
  assert.strictEqual(r.articles, "");
  assert.strictEqual(r.articlesAttemptedCount, 0);
  assert.ok(logMessage?.includes("no articles to validate"));
});

test("validateArticlesNode skips SSRF/unsafe URL", async () => {
  const nodes = createNodes({
    llm: mockLlm,
    openai: mockOpenai,
    config: TEST_CONFIG,
    serper: mockSerper
  });
  const orig = logger.error;
  const logs = [];
  logger.error = (...args) => logs.push(args.join(" "));
  const r = await nodes.validateArticlesNode({
    articles: '"Bad" - desc [http://localhost/evil](http://localhost/evil)'
  });
  logger.error = orig;
  assert.strictEqual(r.articles, "");
  assert.ok(logs.some((m) => m.includes("SSRF") || m.includes("unsafe URL")));
});

test("validateArticlesNode skips HTTP error response", async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes("safebrowsing")) {
      return { ok: true, json: async () => ({ matches: [] }) };
    }
    return {
      ok: false,
      status: 404,
      headers: new Headers({ "content-type": "text/html" }),
      text: async () => ""
    };
  };
  try {
    const nodes = createNodes({
      llm: mockLlm,
      openai: mockOpenai,
      config: TEST_CONFIG,
      serper: mockSerper
    });
    const orig = logger.error;
    logger.error = () => {};
    const r = await nodes.validateArticlesNode({
      articles: '"Title" - desc [https://example.com/missing](https://example.com/missing)'
    });
    logger.error = orig;
    assert.strictEqual(r.articles, "");
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("validateArticlesNode skips unsupported content-type", async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes("safebrowsing")) {
      return { ok: true, json: async () => ({ matches: [] }) };
    }
    return {
      ok: true,
      headers: new Headers({ "content-type": "application/pdf" }),
      text: async () => "binary content"
    };
  };
  try {
    const nodes = createNodes({
      llm: mockLlm,
      openai: mockOpenai,
      config: TEST_CONFIG,
      serper: mockSerper
    });
    const orig = logger.error;
    logger.error = () => {};
    const r = await nodes.validateArticlesNode({
      articles: '"Title" - desc [https://example.com/doc.pdf](https://example.com/doc.pdf)'
    });
    logger.error = orig;
    assert.strictEqual(r.articles, "");
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("validateArticlesNode skips when no extractable text", async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes("safebrowsing")) {
      return { ok: true, json: async () => ({ matches: [] }) };
    }
    return {
      ok: true,
      headers: new Headers({ "content-type": "text/html" }),
      text: async () => "<html><body></body></html>"
    };
  };
  try {
    const nodes = createNodes({
      llm: mockLlm,
      openai: mockOpenai,
      config: TEST_CONFIG,
      serper: mockSerper
    });
    const orig = logger.error;
    logger.error = () => {};
    const r = await nodes.validateArticlesNode({
      articles: '"Title" - desc [https://example.com/empty](https://example.com/empty)'
    });
    logger.error = orig;
    assert.strictEqual(r.articles, "");
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("validateArticlesNode skips content moderation flagged", async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes("safebrowsing")) {
      return { ok: true, json: async () => ({ matches: [] }) };
    }
    return {
      ok: true,
      headers: new Headers({ "content-type": "text/html" }),
      text: async () =>
        '<html><head><title>Bad</title></head><body>Content</body></html>'
    };
  };
  const mockOpenaiFlagged = {
    moderations: { create: async () => ({ results: [{ flagged: true }] }) }
  };
  try {
    const nodes = createNodes({
      llm: mockLlm,
      openai: mockOpenaiFlagged,
      config: TEST_CONFIG,
      serper: mockSerper
    });
    const orig = logger.error;
    logger.error = () => {};
    const r = await nodes.validateArticlesNode({
      articles: '"Title" - desc [https://example.com/flagged](https://example.com/flagged)'
    });
    logger.error = orig;
    assert.strictEqual(r.articles, "");
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("validateArticlesNode logs when all articles fail validation", async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes("safebrowsing")) {
      return { ok: true, json: async () => ({ matches: [] }) };
    }
    return {
      ok: true,
      headers: new Headers({ "content-type": "text/html" }),
      text: async () =>
        '<html><head><title>T</title></head><body>x</body></html>'
    };
  };
  const mockOpenaiFlagged = {
    moderations: { create: async () => ({ results: [{ flagged: true }] }) }
  };
  try {
    const nodes = createNodes({
      llm: mockLlm,
      openai: mockOpenaiFlagged,
      config: TEST_CONFIG,
      serper: mockSerper
    });
    const orig = logger.error;
    const logs = [];
    logger.error = (...args) => logs.push(args.join(" "));
    const r = await nodes.validateArticlesNode({
      articles: '"A" - d [https://example.com/a](https://example.com/a)'
    });
    logger.error = orig;
    assert.ok(
      logs.some((m) => m.includes("all") && m.includes("failed validation"))
    );
    assert.strictEqual(r.articlesAttemptedCount, 1);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("outputNode with single category uses primary tag style", async () => {
  const nodes = createNodes({
    llm: mockLlm,
    openai: mockOpenai,
    config: TEST_CONFIG,
    serper: mockSerper
  });
  const r = await nodes.outputNode({
    userInput: "Q",
    finalAnswer: "Question: Q\n\nAnswer: A",
    articles: "",
    categories: ["OnlyOne"],
    imageUrl: null
  });
  const html = renderPostHtml(r.post);
  assert.ok(html.includes("bg-indigo-100"));
  assert.ok(html.includes("OnlyOne"));
});

test("outputNode with undefined categories", async () => {
  const nodes = createNodes({
    llm: mockLlm,
    openai: mockOpenai,
    config: TEST_CONFIG,
    serper: mockSerper
  });
  const r = await nodes.outputNode({
    userInput: "Q",
    finalAnswer: "Question: Q\n\nAnswer: A",
    articles: "",
    categories: undefined,
    imageUrl: null
  });
  assert.strictEqual(r.post.title, "Q");
  assert.ok(Array.isArray(r.post.categories) && r.post.categories.length === 0);
});
