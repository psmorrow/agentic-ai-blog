/**
 * Unit tests for config loader.
 * Run: node --test src/config.test.js
 */

import { test } from "node:test";
import assert from "node:assert";
import {
  loadConfig,
  FETCH_TIMEOUT_MS,
  MODERATION_TEXT_LIMIT,
  SAFE_BROWSING_TIMEOUT_MS,
  POSTS_DIR,
  METRICS_DIR
} from "./config.js";

const VALID_OPENAI = "sk-test-openai-key";
const VALID_GOOGLE = "test-google-key";
const VALID_SERPER = "test-serper-key";

function withEnv(overrides, fn) {
  const orig = {};
  for (const key of Object.keys(overrides)) {
    orig[key] = process.env[key];
    if (overrides[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = overrides[key];
    }
  }
  try {
    return fn();
  } finally {
    for (const key of Object.keys(overrides)) {
      if (orig[key] === undefined) delete process.env[key];
      else process.env[key] = orig[key];
    }
  }
}

test("config exports constants", () => {
  assert.strictEqual(typeof FETCH_TIMEOUT_MS, "number");
  assert.ok(FETCH_TIMEOUT_MS > 0);
  assert.strictEqual(typeof MODERATION_TEXT_LIMIT, "number");
  assert.ok(MODERATION_TEXT_LIMIT > 0);
  assert.strictEqual(typeof SAFE_BROWSING_TIMEOUT_MS, "number");
  assert.ok(SAFE_BROWSING_TIMEOUT_MS > 0);
  assert.strictEqual(POSTS_DIR, "posts");
  assert.strictEqual(METRICS_DIR, "metrics");
});

test("loadConfig returns frozen config when all keys are set", () => {
  withEnv(
    {
      OPENAI_API_KEY: VALID_OPENAI,
      GOOGLE_SAFE_BROWSING_API_KEY: VALID_GOOGLE,
      SERPER_API_KEY: VALID_SERPER
    },
    () => {
      const config = loadConfig();
      assert.strictEqual(config.OPENAI_API_KEY, VALID_OPENAI);
      assert.strictEqual(config.GOOGLE_SAFE_BROWSING_API_KEY, VALID_GOOGLE);
      assert.strictEqual(config.SERPER_API_KEY, VALID_SERPER);
      assert.strictEqual(config.POSTS_DIR, "posts");
      assert.strictEqual(config.METRICS_DIR, "metrics");
      assert.strictEqual(Object.isFrozen(config), true);
    }
  );
});

test("loadConfig throws when OPENAI_API_KEY is missing", () => {
  withEnv(
    {
      OPENAI_API_KEY: undefined,
      GOOGLE_SAFE_BROWSING_API_KEY: VALID_GOOGLE,
      SERPER_API_KEY: VALID_SERPER
    },
    () => {
      assert.throws(() => loadConfig(), {
        message: /Missing required environment variables: OPENAI_API_KEY/
      });
    }
  );
});

test("loadConfig throws when GOOGLE_SAFE_BROWSING_API_KEY is missing", () => {
  withEnv(
    {
      OPENAI_API_KEY: VALID_OPENAI,
      GOOGLE_SAFE_BROWSING_API_KEY: undefined,
      SERPER_API_KEY: VALID_SERPER
    },
    () => {
      assert.throws(() => loadConfig(), {
        message: /Missing required environment variables: GOOGLE_SAFE_BROWSING_API_KEY/
      });
    }
  );
});

test("loadConfig throws when SERPER_API_KEY is missing", () => {
  withEnv(
    {
      OPENAI_API_KEY: VALID_OPENAI,
      GOOGLE_SAFE_BROWSING_API_KEY: VALID_GOOGLE,
      SERPER_API_KEY: undefined
    },
    () => {
      assert.throws(() => loadConfig(), {
        message: /Missing required environment variables: SERPER_API_KEY/
      });
    }
  );
});

test("loadConfig throws when all keys are missing", () => {
  withEnv(
    {
      OPENAI_API_KEY: undefined,
      GOOGLE_SAFE_BROWSING_API_KEY: undefined,
      SERPER_API_KEY: undefined
    },
    () => {
      assert.throws(() => loadConfig(), {
        message:
          /Missing required environment variables: OPENAI_API_KEY, GOOGLE_SAFE_BROWSING_API_KEY, SERPER_API_KEY/
      });
    }
  );
});

test("loadConfig throws when OPENAI_API_KEY is empty string", () => {
  withEnv(
    {
      OPENAI_API_KEY: "",
      GOOGLE_SAFE_BROWSING_API_KEY: VALID_GOOGLE,
      SERPER_API_KEY: VALID_SERPER
    },
    () => {
      assert.throws(() => loadConfig(), {
        message: /Missing required environment variables: OPENAI_API_KEY/
      });
    }
  );
});

test("loadConfig throws when GOOGLE_SAFE_BROWSING_API_KEY is whitespace only", () => {
  withEnv(
    {
      OPENAI_API_KEY: VALID_OPENAI,
      GOOGLE_SAFE_BROWSING_API_KEY: "   ",
      SERPER_API_KEY: VALID_SERPER
    },
    () => {
      assert.throws(() => loadConfig(), {
        message: /Missing required environment variables: GOOGLE_SAFE_BROWSING_API_KEY/
      });
    }
  );
});
