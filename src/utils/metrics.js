/**
 * Run metrics collector.
 * Records blog_generation_total, blog_generation_duration_seconds,
 * node_duration_seconds, articles_validated_count.
 * Writes JSON lines to metrics/ folder.
 */

import { mkdir } from "fs/promises";
import { appendFile } from "fs/promises";
import { join } from "path";

const DEFAULT_METRICS_DIR = "metrics";
const RUNS_FILE = "blog_runs.jsonl";

/**
 * Creates a metrics collector for a single run.
 * @param {string} [metricsDir] - Directory for metrics output (default: "metrics")
 * @returns {{
 *   recordNodeDuration: (name: string, seconds: number) => void;
 *   finalize: (status: "success" | "failure", options?: { failureReason?: string, articlesValidatedCount?: number, articlesAttemptedCount?: number }) => Promise<void>;
 * }}
 */
export function createRunMetrics(metricsDir = DEFAULT_METRICS_DIR) {
  const startTime = performance.now();
  const nodeDurations = {};

  return {
    recordNodeDuration(name, seconds) {
      nodeDurations[name] = seconds;
    },

    async finalize(status, options = {}) {
      const durationSeconds = (performance.now() - startTime) / 1000;

      const record = {
        timestamp: new Date().toISOString(),
        status,
        duration_seconds: Math.round(durationSeconds * 1000) / 1000,
        node_durations_seconds: Object.keys(nodeDurations).length
          ? nodeDurations
          : undefined,
        articles_validated_count: options.articlesValidatedCount,
        articles_attempted_count: options.articlesAttemptedCount,
        ...(status === "failure" && options.failureReason
          ? { failure_reason: options.failureReason }
          : {})
      };

      await mkdir(metricsDir, { recursive: true });
      const path = join(metricsDir, RUNS_FILE);
      await appendFile(path, JSON.stringify(record) + "\n", "utf-8");
    }
  };
}

/**
 * Wraps a node function to record its duration.
 * @param {string} name - Node name
 * @param {(state: object) => Promise<object>} nodeFn - Original node
 * @param {(name: string, seconds: number) => void} recordDuration - Callback to record
 * @returns {(state: object) => Promise<object>}
 */
export function withNodeTiming(name, nodeFn, recordDuration) {
  return async (state) => {
    const start = performance.now();
    try {
      const result = await nodeFn(state);
      recordDuration(name, (performance.now() - start) / 1000);
      return result;
    } catch (err) {
      recordDuration(name, (performance.now() - start) / 1000);
      throw err;
    }
  };
}
