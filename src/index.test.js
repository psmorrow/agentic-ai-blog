/**
 * Unit tests for CLI entry point (index.js).
 * Tests input validation and runBlogGenerator logic (with mocks).
 */

import { test } from "node:test";
import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { runBlogGenerator } from "./index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const indexPath = join(__dirname, "index.js");

/**
 * Spawns the CLI with the given arguments.
 * @param {string[]} args - Command-line arguments
 * @returns {import("node:child_process").SpawnSyncReturns<string>}
 */
function runCli(args) {
  return spawnSync(
    process.execPath,
    [indexPath, ...args],
    { encoding: "utf-8", env: { ...process.env, OPENAI_API_KEY: "" } }
  );
}

test("--help shows usage and exits 0", () => {
  const r = runCli(["--help"]);
  assert.strictEqual(r.status, 0);
  assert.ok(r.stdout?.includes("Usage:"));
  assert.ok(r.stdout?.includes("Example:"));
});

test("no userInput exits with usage", () => {
  const r = runCli([]);
  assert.strictEqual(r.status, 1);
  assert.ok(r.stderr?.includes("Usage:"));
});

test("userInput too long exits with error", () => {
  const longQuestion = "x".repeat(4001);
  const r = runCli([longQuestion]);
  assert.strictEqual(r.status, 1);
  assert.ok(r.stderr?.includes("Question too long"));
  assert.ok(r.stderr?.includes("4000"));
});

test("audience too long exits with error", () => {
  const r = runCli(["What is X?", "--audience=" + "a".repeat(401)]);
  assert.strictEqual(r.status, 1);
  assert.ok(r.stderr?.includes("Audience too long"));
  assert.ok(r.stderr?.includes("400"));
});

test("userInput at limit does not fail validation", () => {
  const atLimit = "x".repeat(4000);
  const r = runCli([atLimit]);
  assert.ok(!r.stderr?.includes("Question too long"));
});

test("audience at limit does not fail validation", () => {
  const atLimit = "a".repeat(400);
  const r = runCli(["What is X?", "--audience=" + atLimit]);
  assert.ok(!r.stderr?.includes("Audience too long"));
});

test("runBlogGenerator success writes html and finalizes metrics", async () => {
  const postsDir = mkdtempSync(join(tmpdir(), "blog-posts-"));
  const metricsDir = mkdtempSync(join(tmpdir(), "blog-metrics-"));
  const writtenFiles = {};
  const logCalls = [];
  const finalizeCalls = [];

  const createStream = async function* () {
    yield ["values", {
      post: { slug: "what-is-x", title: "What is X?", bodyHtml: "<p>Done</p>", categories: [], articles: [], imageUrl: null },
      userInput: "What is X?",
      articles: "",
      articlesAttemptedCount: 0
    }];
  };

  try {
    await runBlogGenerator({
      userInput: "What is X?",
      deps: {
        loadConfig: () => ({}),
        createAgent: () => ({
          stream: () => createStream()
        }),
        createRunMetrics: (dir) => ({
          finalize: async (status, opts) => { finalizeCalls.push({ status, opts }); }
        }),
        logger: { log: (m) => logCalls.push(m), error: () => {} },
        slugify: (s) => s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
        isUrlSafeForFetch: () => false,
        writeFile: async (path, content) => { writtenFiles[path] = content; },
        mkdir: async () => {},
        join: (...p) => p.join("/"),
        POSTS_DIR: postsDir,
        METRICS_DIR: metricsDir,
        IMAGE_FETCH_TIMEOUT_MS: 1000,
        IMAGE_FETCH_RETRIES: 1
      }
    });

    assert.strictEqual(finalizeCalls.length, 1);
    assert.strictEqual(finalizeCalls[0].status, "success");
    assert.ok(Object.keys(writtenFiles).some((p) => p.endsWith(".json")));
    assert.ok(logCalls.some((m) => m.includes("Blog saved")));
  } finally {
    rmSync(postsDir, { recursive: true, force: true });
    rmSync(metricsDir, { recursive: true, force: true });
  }
});

test("runBlogGenerator processes updates and logs node labels", async () => {
  const postsDir = mkdtempSync(join(tmpdir(), "blog-posts-"));
  const metricsDir = mkdtempSync(join(tmpdir(), "blog-metrics-"));
  const logCalls = [];

  const createStream = async function* () {
    yield ["updates", { __metadata__: {}, answerNode: {} }];
    yield ["updates", { editorNode: {} }];
    yield ["values", {
      post: { slug: "q", title: "Q", bodyHtml: "<p>Done</p>", categories: [], articles: [], imageUrl: null },
      userInput: "Q",
      articles: "",
      articlesAttemptedCount: 0
    }];
  };

  try {
    await runBlogGenerator({
      userInput: "Q",
      deps: {
        loadConfig: () => ({}),
        createAgent: () => ({ stream: () => createStream() }),
        createRunMetrics: () => ({ finalize: async () => {} }),
        logger: { log: (m) => logCalls.push(m), error: () => {} },
        slugify: (s) => "q",
        isUrlSafeForFetch: () => false,
        writeFile: async () => {},
        mkdir: async () => {},
        join: (...p) => p.join("/"),
        POSTS_DIR: postsDir,
        METRICS_DIR: metricsDir,
        IMAGE_FETCH_TIMEOUT_MS: 1000,
        IMAGE_FETCH_RETRIES: 1
      }
    });

    assert.ok(logCalls.some((m) => m.includes("Generate answer")));
    assert.ok(logCalls.some((m) => m.includes("Edit question")));
  } finally {
    rmSync(postsDir, { recursive: true, force: true });
    rmSync(metricsDir, { recursive: true, force: true });
  }
});

test("runBlogGenerator throws when result has no html", async () => {
  const metricsDir = mkdtempSync(join(tmpdir(), "blog-metrics-"));

  const createStream = async function* () {
    yield ["values", { userInput: "Q", articles: "" }];
  };

  try {
    await assert.rejects(
      runBlogGenerator({
        userInput: "Q",
        deps: {
          loadConfig: () => ({}),
          createAgent: () => ({ stream: () => createStream() }),
          createRunMetrics: () => ({ finalize: async () => {} }),
          logger: { log: () => {}, error: () => {} },
          slugify: () => "q",
          isUrlSafeForFetch: () => false,
          writeFile: async () => {},
          mkdir: async () => {},
          join: (...p) => p.join("/"),
          POSTS_DIR: "/tmp/p",
          METRICS_DIR: metricsDir,
          IMAGE_FETCH_TIMEOUT_MS: 1000,
          IMAGE_FETCH_RETRIES: 1
        }
      }),
      /Generation did not complete successfully/
    );
  } finally {
    rmSync(metricsDir, { recursive: true, force: true });
  }
});

test("runBlogGenerator image fetch retries on ECONNRESET (cause.code) then succeeds", async () => {
  const origFetch = globalThis.fetch;
  const postsDir = mkdtempSync(join(tmpdir(), "blog-posts-"));
  const metricsDir = mkdtempSync(join(tmpdir(), "blog-metrics-"));
  let callCount = 0;

  globalThis.fetch = async () => {
    callCount++;
    if (callCount === 1) {
      const err = new Error("Connection reset");
      err.cause = { code: "ECONNRESET" };
      throw err;
    }
    return { ok: true, arrayBuffer: async () => Buffer.from("ok") };
  };

  const createStream = async function* () {
    yield ["values", {
      post: { slug: "q", title: "Q", bodyHtml: "<p>Done</p>", categories: [], articles: [], imageUrl: "https://x.com/i.png" },
      userInput: "Q",
      imageUrl: "https://x.com/i.png",
      articles: "",
      articlesAttemptedCount: 0
    }];
  };

  try {
    await runBlogGenerator({
      userInput: "Q",
      deps: {
        loadConfig: () => ({}),
        createAgent: () => ({ stream: () => createStream() }),
        createRunMetrics: () => ({ finalize: async () => {} }),
        logger: { log: () => {}, error: () => {} },
        slugify: () => "q",
        isUrlSafeForFetch: async () => true,
        writeFile: async () => {},
        mkdir: async () => {},
        join: (...p) => p.join("/"),
        POSTS_DIR: postsDir,
        METRICS_DIR: metricsDir,
        IMAGE_FETCH_TIMEOUT_MS: 1000,
        IMAGE_FETCH_RETRIES: 2
      }
    });
    assert.strictEqual(callCount, 2);
  } finally {
    globalThis.fetch = origFetch;
    rmSync(postsDir, { recursive: true, force: true });
    rmSync(metricsDir, { recursive: true, force: true });
  }
});

test("runBlogGenerator image fetch retries on 500 then succeeds", async () => {
  const origFetch = globalThis.fetch;
  const postsDir = mkdtempSync(join(tmpdir(), "blog-posts-"));
  const metricsDir = mkdtempSync(join(tmpdir(), "blog-metrics-"));
  let callCount = 0;

  globalThis.fetch = async () => {
    callCount++;
    if (callCount === 1) {
      const err = new Error("HTTP 500");
      err.response = { status: 500 };
      throw err;
    }
    return {
      ok: true,
      arrayBuffer: async () => Buffer.from("fake-png")
    };
  };

  const createStream = async function* () {
    yield ["values", {
      post: { slug: "q", title: "Q", bodyHtml: "<p>Done</p>", categories: [], articles: [], imageUrl: "https://example.com/img.png" },
      userInput: "Q",
      imageUrl: "https://example.com/img.png",
      articles: "",
      articlesAttemptedCount: 0
    }];
  };

  try {
    await runBlogGenerator({
      userInput: "Q",
      deps: {
        loadConfig: () => ({}),
        createAgent: () => ({ stream: () => createStream() }),
        createRunMetrics: () => ({ finalize: async () => {} }),
        logger: { log: () => {}, error: () => {} },
        slugify: () => "q",
        isUrlSafeForFetch: async () => true,
        writeFile: async () => {},
        mkdir: async () => {},
        join: (...p) => p.join("/"),
        POSTS_DIR: postsDir,
        METRICS_DIR: metricsDir,
        IMAGE_FETCH_TIMEOUT_MS: 1000,
        IMAGE_FETCH_RETRIES: 2
      }
    });
    assert.strictEqual(callCount, 2, "should retry after 500");
  } finally {
    globalThis.fetch = origFetch;
    rmSync(postsDir, { recursive: true, force: true });
    rmSync(metricsDir, { recursive: true, force: true });
  }
});

test("runBlogGenerator with imageUrl downloads and embeds image", async () => {
  const origFetch = globalThis.fetch;
  const postsDir = mkdtempSync(join(tmpdir(), "blog-posts-"));
  const metricsDir = mkdtempSync(join(tmpdir(), "blog-metrics-"));
  const writtenFiles = {};
  const logCalls = [];

  globalThis.fetch = async () => ({
    ok: true,
    arrayBuffer: async () => Buffer.from("fake-png")
  });

  const createStream = async function* () {
    yield ["values", {
      post: { slug: "what-is-x", title: "What is X?", bodyHtml: "<p>Done</p>", categories: [], articles: [], imageUrl: "https://example.com/img.png" },
      userInput: "What is X?",
      imageUrl: "https://example.com/img.png",
      articles: "",
      articlesAttemptedCount: 0
    }];
  };

  try {
    await runBlogGenerator({
      userInput: "What is X?",
      deps: {
        loadConfig: () => ({}),
        createAgent: () => ({ stream: () => createStream() }),
        createRunMetrics: () => ({ finalize: async () => {} }),
        logger: { log: (m) => logCalls.push(m), error: () => {} },
        slugify: (s) => "what-is-x",
        isUrlSafeForFetch: async () => true,
        writeFile: async (path, content) => { writtenFiles[path] = content; },
        mkdir: async () => {},
        join: (...p) => p.join("/"),
        POSTS_DIR: postsDir,
        METRICS_DIR: metricsDir,
        IMAGE_FETCH_TIMEOUT_MS: 1000,
        IMAGE_FETCH_RETRIES: 1
      }
    });

    const pngPath = Object.keys(writtenFiles).find((p) => p.endsWith(".png"));
    assert.ok(pngPath, "png file should be written");
    const jsonPath = Object.keys(writtenFiles).find((p) => p.endsWith(".json"));
    const post = JSON.parse(writtenFiles[jsonPath]);
    assert.ok(post.imageFilename, "json should have imageFilename");
    assert.ok(logCalls.some((m) => m.includes("Image saved")));
  } finally {
    globalThis.fetch = origFetch;
    rmSync(postsDir, { recursive: true, force: true });
    rmSync(metricsDir, { recursive: true, force: true });
  }
});

test("runBlogGenerator image fetch returns non-ok (covers !imageResponse.ok branch)", async () => {
  const origFetch = globalThis.fetch;
  const postsDir = mkdtempSync(join(tmpdir(), "blog-posts-"));
  const metricsDir = mkdtempSync(join(tmpdir(), "blog-metrics-"));
  const errorCalls = [];

  globalThis.fetch = async () => ({
    ok: false,
    status: 500
  });

  const createStream = async function* () {
    yield ["values", {
      post: { slug: "q", title: "Q", bodyHtml: "<p>Done</p>", categories: [], articles: [], imageUrl: "https://example.com/img.png" },
      userInput: "Q",
      imageUrl: "https://example.com/img.png",
      articles: "",
      articlesAttemptedCount: 0
    }];
  };

  try {
    await runBlogGenerator({
      userInput: "Q",
      deps: {
        loadConfig: () => ({}),
        createAgent: () => ({ stream: () => createStream() }),
        createRunMetrics: () => ({ finalize: async () => {} }),
        logger: { log: () => {}, error: (m) => { errorCalls.push(m); } },
        slugify: () => "q",
        isUrlSafeForFetch: async () => true,
        writeFile: async () => {},
        mkdir: async () => {},
        join: (...p) => p.join("/"),
        POSTS_DIR: postsDir,
        METRICS_DIR: metricsDir,
        IMAGE_FETCH_TIMEOUT_MS: 1000,
        IMAGE_FETCH_RETRIES: 2
      }
    });
    assert.ok(errorCalls.some((m) => String(m).includes("Image download failed")));
  } finally {
    globalThis.fetch = origFetch;
    rmSync(postsDir, { recursive: true, force: true });
    rmSync(metricsDir, { recursive: true, force: true });
  }
});

test("runBlogGenerator image download failure removes figure", async () => {
  const origFetch = globalThis.fetch;
  const postsDir = mkdtempSync(join(tmpdir(), "blog-posts-"));
  const metricsDir = mkdtempSync(join(tmpdir(), "blog-metrics-"));
  const logCalls = [];
  const errorCalls = [];

  globalThis.fetch = async () => {
    const err = new Error("HTTP 404");
    err.status = 404;
    throw err;
  };

  const createStream = async function* () {
    yield ["values", {
      post: { slug: "q", title: "Q", bodyHtml: "<p>Done</p>", categories: [], articles: [], imageUrl: "https://example.com/img.png" },
      userInput: "Q",
      imageUrl: "https://example.com/img.png",
      articles: "",
      articlesAttemptedCount: 0
    }];
  };

  try {
    await runBlogGenerator({
      userInput: "Q",
      deps: {
        loadConfig: () => ({}),
        createAgent: () => ({ stream: () => createStream() }),
        createRunMetrics: () => ({ finalize: async () => {} }),
        logger: {
          log: (m) => logCalls.push(m),
          error: (m) => { errorCalls.push(m); }
        },
        slugify: () => "q",
        isUrlSafeForFetch: async () => true,
        writeFile: async (path, content) => {
          if (path.endsWith(".json")) {
            const post = JSON.parse(content);
            assert.ok(!post.imageFilename, "json should not have imageFilename when download fails");
          }
        },
        mkdir: async () => {},
        join: (...p) => p.join("/"),
        POSTS_DIR: postsDir,
        METRICS_DIR: metricsDir,
        IMAGE_FETCH_TIMEOUT_MS: 1000,
        IMAGE_FETCH_RETRIES: 1
      }
    });
    assert.ok(errorCalls.some((m) => typeof m === "string" && m.includes("Image download failed")));
  } finally {
    globalThis.fetch = origFetch;
    rmSync(postsDir, { recursive: true, force: true });
    rmSync(metricsDir, { recursive: true, force: true });
  }
});

test("runBlogGenerator handles non-array chunk as values", async () => {
  const postsDir = mkdtempSync(join(tmpdir(), "blog-posts-"));
  const metricsDir = mkdtempSync(join(tmpdir(), "blog-metrics-"));

  const createStream = async function* () {
    yield {
      post: { slug: "q", title: "Q", bodyHtml: "<p>Done</p>", categories: [], articles: [], imageUrl: null },
      userInput: "Q",
      articles: "",
      articlesAttemptedCount: 0
    };
  };

  try {
    await runBlogGenerator({
      userInput: "Q",
      deps: {
        loadConfig: () => ({}),
        createAgent: () => ({ stream: () => createStream() }),
        createRunMetrics: () => ({ finalize: async () => {} }),
        logger: { log: () => {}, error: () => {} },
        slugify: () => "q",
        isUrlSafeForFetch: () => false,
        writeFile: async () => {},
        mkdir: async () => {},
        join: (...p) => p.join("/"),
        POSTS_DIR: postsDir,
        METRICS_DIR: metricsDir,
        IMAGE_FETCH_TIMEOUT_MS: 1000,
        IMAGE_FETCH_RETRIES: 1
      }
    });
    assert.ok(true, "completed with plain object chunk");
  } finally {
    rmSync(postsDir, { recursive: true, force: true });
    rmSync(metricsDir, { recursive: true, force: true });
  }
});

test("runBlogGenerator with imageUrl skips download when url not safe", async () => {
  const postsDir = mkdtempSync(join(tmpdir(), "blog-posts-"));
  const metricsDir = mkdtempSync(join(tmpdir(), "blog-metrics-"));

  const createStream = async function* () {
    yield ["values", {
      post: { slug: "q", title: "Q", bodyHtml: "<p>Done</p>", categories: [], articles: [], imageUrl: null },
      userInput: "Q",
      imageUrl: "https://bad.com/img.png",
      articles: "",
      articlesAttemptedCount: 0
    }];
  };

  try {
    await runBlogGenerator({
      userInput: "Q",
      deps: {
        loadConfig: () => ({}),
        createAgent: () => ({ stream: () => createStream() }),
        createRunMetrics: () => ({ finalize: async () => {} }),
        logger: { log: () => {}, error: () => {} },
        slugify: () => "q",
        isUrlSafeForFetch: async () => false,
        writeFile: async () => {},
        mkdir: async () => {},
        join: (...p) => p.join("/"),
        POSTS_DIR: postsDir,
        METRICS_DIR: metricsDir,
        IMAGE_FETCH_TIMEOUT_MS: 1000,
        IMAGE_FETCH_RETRIES: 1
      }
    });
  } finally {
    rmSync(postsDir, { recursive: true, force: true });
    rmSync(metricsDir, { recursive: true, force: true });
  }
});

test("runBlogGenerator uses userInput fallback when result.userInput missing", async () => {
  const postsDir = mkdtempSync(join(tmpdir(), "blog-posts-"));
  const metricsDir = mkdtempSync(join(tmpdir(), "blog-metrics-"));
  const writtenFiles = {};

  const createStream = async function* () {
    yield ["values", {
      post: { slug: "my-question-here", title: "My Question Here", bodyHtml: "<p>Done</p>", categories: [], articles: [], imageUrl: null },
      articles: "",
      articlesAttemptedCount: 0
    }];
  };

  try {
    await runBlogGenerator({
      userInput: "My Question Here",
      deps: {
        loadConfig: () => ({}),
        createAgent: () => ({ stream: () => createStream() }),
        createRunMetrics: () => ({ finalize: async () => {} }),
        logger: { log: () => {}, error: () => {} },
        slugify: (s) => s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "q",
        isUrlSafeForFetch: () => false,
        writeFile: async (path) => { writtenFiles[path] = true; },
        mkdir: async () => {},
        join: (...p) => p.join("/"),
        POSTS_DIR: postsDir,
        METRICS_DIR: metricsDir,
        IMAGE_FETCH_TIMEOUT_MS: 1000,
        IMAGE_FETCH_RETRIES: 1
      }
    });
    assert.ok(Object.keys(writtenFiles).some((p) => p.includes("my-question-here")), "slug from userInput fallback");
  } finally {
    rmSync(postsDir, { recursive: true, force: true });
    rmSync(metricsDir, { recursive: true, force: true });
  }
});

test("runBlogGenerator catch logs API status from err.response", async () => {
  const metricsDir = mkdtempSync(join(tmpdir(), "blog-metrics-"));
  const errorCalls = [];
  const err = new Error("API error");
  err.response = { status: 503 };

  try {
    await assert.rejects(
      runBlogGenerator({
        userInput: "Q",
        deps: {
          loadConfig: () => { throw err; },
          createAgent: () => {},
          createRunMetrics: () => ({ finalize: async () => {} }),
          logger: { log: () => {}, error: (m) => { errorCalls.push(m); } },
          slugify: () => "q",
          isUrlSafeForFetch: () => false,
          writeFile: async () => {},
          mkdir: async () => {},
          join: (...p) => p.join("/"),
          POSTS_DIR: "/tmp/p",
          METRICS_DIR: metricsDir,
          IMAGE_FETCH_TIMEOUT_MS: 1000,
          IMAGE_FETCH_RETRIES: 1
        }
      }),
      /API error/
    );
    assert.ok(errorCalls.some((m) => String(m).includes("API status")), "logs status from err.response");
  } finally {
    rmSync(metricsDir, { recursive: true, force: true });
  }
});

test("runBlogGenerator catch finalizes failure and logs API status", async () => {
  const metricsDir = mkdtempSync(join(tmpdir(), "blog-metrics-"));
  const finalizeCalls = [];
  const errorCalls = [];

  const err = new Error("API error");
  err.status = 429;

  try {
    await assert.rejects(
      runBlogGenerator({
        userInput: "Q",
        deps: {
          loadConfig: () => { throw err; },
          createAgent: () => {},
          createRunMetrics: () => ({
            finalize: async (status, opts) => { finalizeCalls.push({ status, opts }); }
          }),
          logger: { log: () => {}, error: (m) => { errorCalls.push(m); } },
          slugify: () => "q",
          isUrlSafeForFetch: () => false,
          writeFile: async () => {},
          mkdir: async () => {},
          join: (...p) => p.join("/"),
          POSTS_DIR: "/tmp/p",
          METRICS_DIR: metricsDir,
          IMAGE_FETCH_TIMEOUT_MS: 1000,
          IMAGE_FETCH_RETRIES: 1
        }
      }),
      /API error/
    );

    assert.strictEqual(finalizeCalls.length, 1);
    assert.strictEqual(finalizeCalls[0].status, "failure");
    assert.strictEqual(finalizeCalls[0].opts.failureReason, "API error");
    assert.ok(errorCalls.some((m) => typeof m === "string" && m.includes("API status")));
  } finally {
    rmSync(metricsDir, { recursive: true, force: true });
  }
});

test("runBlogGenerator with audience passes audience to stream", async () => {
  const postsDir = mkdtempSync(join(tmpdir(), "blog-posts-"));
  const metricsDir = mkdtempSync(join(tmpdir(), "blog-metrics-"));
  let streamInput = null;

  const createStream = (input) => {
    streamInput = input;
    return (async function* () {
      yield ["values", {
        post: { slug: "q", title: "Q", bodyHtml: "<p>Done</p>", categories: [], articles: [], imageUrl: null },
        userInput: "Q",
        articles: "",
        articlesAttemptedCount: 0
      }];
    })();
  };

  const mockApp = { stream: (input) => createStream(input) };

  try {
    await runBlogGenerator({
      userInput: "Q",
      audience: "sixth grader, grade 6 reading level",
      deps: {
        loadConfig: () => ({}),
        createAgent: () => mockApp,
        createRunMetrics: () => ({ finalize: async () => {} }),
        logger: { log: () => {}, error: () => {} },
        slugify: () => "q",
        isUrlSafeForFetch: () => false,
        writeFile: async () => {},
        mkdir: async () => {},
        join: (...p) => p.join("/"),
        POSTS_DIR: postsDir,
        METRICS_DIR: metricsDir,
        IMAGE_FETCH_TIMEOUT_MS: 1000,
        IMAGE_FETCH_RETRIES: 1
      }
    });
    assert.strictEqual(streamInput?.audience, "sixth grader, grade 6 reading level");
  } finally {
    rmSync(postsDir, { recursive: true, force: true });
    rmSync(metricsDir, { recursive: true, force: true });
  }
});

test("runBlogGenerator with tone and length passes to stream", async () => {
  const postsDir = mkdtempSync(join(tmpdir(), "blog-posts-"));
  const metricsDir = mkdtempSync(join(tmpdir(), "blog-metrics-"));
  let streamInput = null;

  const createStream = (input) => {
    streamInput = input;
    return (async function* () {
      yield ["values", {
        post: { slug: "q", title: "Q", bodyHtml: "<p>Done</p>", categories: [], articles: [], imageUrl: null },
        userInput: "Q",
        articles: "",
        articlesAttemptedCount: 0
      }];
    })();
  };

  const mockApp = { stream: (input) => createStream(input) };

  try {
    await runBlogGenerator({
      userInput: "Q",
      audience: "engineers",
      tone: "formal",
      length: "brief",
      deps: {
        loadConfig: () => ({}),
        createAgent: () => mockApp,
        createRunMetrics: () => ({ finalize: async () => {} }),
        logger: { log: () => {}, error: () => {} },
        slugify: () => "q",
        isUrlSafeForFetch: () => false,
        writeFile: async () => {},
        mkdir: async () => {},
        join: (...p) => p.join("/"),
        POSTS_DIR: postsDir,
        METRICS_DIR: metricsDir,
        IMAGE_FETCH_TIMEOUT_MS: 1000,
        IMAGE_FETCH_RETRIES: 1
      }
    });
    assert.strictEqual(streamInput?.tone, "formal");
    assert.strictEqual(streamInput?.length, "brief");
  } finally {
    rmSync(postsDir, { recursive: true, force: true });
    rmSync(metricsDir, { recursive: true, force: true });
  }
});

test("runBlogGenerator articlesValidatedCount and articlesAttemptedCount", async () => {
  const postsDir = mkdtempSync(join(tmpdir(), "blog-posts-"));
  const metricsDir = mkdtempSync(join(tmpdir(), "blog-metrics-"));
  const finalizeCalls = [];

  const createStream = async function* () {
    yield ["values", {
      post: { slug: "q", title: "Q", bodyHtml: "<p>Done</p>", categories: [], articles: [], imageUrl: null },
      userInput: "Q",
      articles: "Line 1\nLine 2\nLine 3",
      articlesAttemptedCount: 5,
      articlesValidatedCount: 3
    }];
  };

  try {
    await runBlogGenerator({
      userInput: "Q",
      deps: {
        loadConfig: () => ({}),
        createAgent: () => ({ stream: () => createStream() }),
        createRunMetrics: () => ({
          finalize: async (status, opts) => { finalizeCalls.push({ status, opts }); }
        }),
        logger: { log: () => {}, error: () => {} },
        slugify: () => "q",
        isUrlSafeForFetch: () => false,
        writeFile: async () => {},
        mkdir: async () => {},
        join: (...p) => p.join("/"),
        POSTS_DIR: postsDir,
        METRICS_DIR: metricsDir,
        IMAGE_FETCH_TIMEOUT_MS: 1000,
        IMAGE_FETCH_RETRIES: 1
      }
    });
    assert.strictEqual(finalizeCalls[0].opts.articlesValidatedCount, 3);
    assert.strictEqual(finalizeCalls[0].opts.articlesAttemptedCount, 5);
  } finally {
    rmSync(postsDir, { recursive: true, force: true });
    rmSync(metricsDir, { recursive: true, force: true });
  }
});
