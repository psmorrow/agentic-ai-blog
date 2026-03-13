/**
 * Unit tests for metrics module.
 * Run: node --test src/utils/metrics.test.js
 */

import { test } from "node:test";
import assert from "node:assert";
import { readFile, rm } from "fs/promises";
import { join } from "path";
import {
  createRunMetrics,
  withNodeTiming
} from "./metrics.js";

const TEST_METRICS_DIR = "metrics_test_output";

test("createRunMetrics records node durations and finalizes", async () => {
  const metrics = createRunMetrics(TEST_METRICS_DIR);
  metrics.recordNodeDuration("answerNode", 1.5);
  metrics.recordNodeDuration("editorNode", 0.8);
  await metrics.finalize("success", {
    articlesValidatedCount: 3,
    articlesAttemptedCount: 5
  });

  const path = join(TEST_METRICS_DIR, "blog_runs.jsonl");
  const content = await readFile(path, "utf-8");
  const record = JSON.parse(content.trim());
  assert.strictEqual(record.status, "success");
  assert.ok(typeof record.duration_seconds === "number");
  assert.strictEqual(record.node_durations_seconds.answerNode, 1.5);
  assert.strictEqual(record.node_durations_seconds.editorNode, 0.8);
  assert.strictEqual(record.articles_validated_count, 3);
  assert.strictEqual(record.articles_attempted_count, 5);
  assert.ok(record.timestamp);

  await rm(path);
  await rm(TEST_METRICS_DIR, { recursive: true }).catch(() => {});
});

test("createRunMetrics records failure with reason", async () => {
  const metrics = createRunMetrics(TEST_METRICS_DIR);
  await metrics.finalize("failure", {
    failureReason: "Answer could not be verified"
  });

  const path = join(TEST_METRICS_DIR, "blog_runs.jsonl");
  const content = await readFile(path, "utf-8");
  const record = JSON.parse(content.trim());
  assert.strictEqual(record.status, "failure");
  assert.strictEqual(record.failure_reason, "Answer could not be verified");

  await rm(path);
  await rm(TEST_METRICS_DIR, { recursive: true }).catch(() => {});
});

test("withNodeTiming records duration and returns result", async () => {
  const durations = {};
  const recordDuration = (name, secs) => {
    durations[name] = secs;
  };
  const mockNode = async (state) => ({ foo: state.input });
  const wrapped = withNodeTiming("testNode", mockNode, recordDuration);

  const result = await wrapped({ input: 42 });
  assert.deepStrictEqual(result, { foo: 42 });
  assert.ok(typeof durations.testNode === "number");
  assert.ok(durations.testNode >= 0);
});
