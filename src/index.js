/**
 * Blog Post Generator
 *
 * Run: node src/index.js "<question>" [--audience="..."] [--tone=formal|casual|technical] [--length=brief|medium|detailed]
 * Example: node src/index.js "What is a camshaft?"
 * Example: node src/index.js "What is a camshaft?" --audience="sixth grader" --tone=casual --length=medium
 *
 * Generates a complete blog post from a question, including:
 * - Answer (tailored to audience, tone, and length)
 * - Professional editing
 * - Verification
 * - Categories
 * - Recommended articles
 * - AI-generated image
 * - Structured post data (JSON) and image written to posts/
 */

import { loadConfig, POSTS_DIR, IMAGE_FETCH_TIMEOUT_MS, IMAGE_FETCH_RETRIES, METRICS_DIR } from "./config.js";
import { createRunMetrics } from "./utils/metrics.js";
import { createAgent } from "./graph/index.js";
import { logger } from "./utils/logger.js";
import { slugify } from "./utils/content.js";
import { isUrlSafeForFetch } from "./utils/urlValidation.js";
import { writeFile, mkdir } from "fs/promises";
import { join, resolve } from "path";
import { fileURLToPath } from "node:url";

const MAX_USER_INPUT_LENGTH = 4000;
const MAX_AUDIENCE_LENGTH = 400;

const USAGE = `Usage: node src/index.js "<question>" [--audience="..."] [--tone=formal|casual|technical] [--length=brief|medium|detailed]
Example: node src/index.js "What is a camshaft?"
Example: node src/index.js "What is a camshaft?" --audience="sixth grader" --tone=casual --length=medium

Generates a blog post with answer, editing, verification, categories, articles, and image.
All options use named flags. Audience can describe who and optionally grade/reading level.
Requires OPENAI_API_KEY, GOOGLE_SAFE_BROWSING_API_KEY, and SERPER_API_KEY in environment.`;

export const NODE_LABEL_MAP = Object.freeze({
  answerNode: "Generate answer to question",
  editorNode: "Edit question and answer",
  verifyNode: "Verify question and answer are safe and relevant",
  verifiedForkNode: "Fork to categorize, articles, and image branches",
  categorizeNode: "Categorize question and answer",
  articlesNode: "Search for 5 recommended articles",
  validateArticlesNode: "Verify articles are safe and relevant",
  imageNode: "Generate an image for the blog post",
  validateImageNode: "Verify image is safe and relevant",
  outputNode: "Save the post data and image"
});

const defaultDeps = {
  loadConfig,
  createAgent,
  createRunMetrics,
  logger,
  slugify,
  isUrlSafeForFetch,
  writeFile,
  mkdir,
  join,
  POSTS_DIR,
  IMAGE_FETCH_TIMEOUT_MS,
  IMAGE_FETCH_RETRIES,
  METRICS_DIR
};

/**
 * Runs the blog generation pipeline. Exported for testing.
 * @param {{ userInput: string, audience?: string, tone?: string, length?: string, deps?: Partial<typeof defaultDeps> }} opts
 */
export async function runBlogGenerator({ userInput, audience, tone, length, deps = {} }) {
  const d = { ...defaultDeps, ...deps };
  const metrics = d.createRunMetrics(d.METRICS_DIR);
  try {
    const config = d.loadConfig();
    const app = d.createAgent({ config, metricsCollector: metrics });
    const streamInput = { userInput };
    if (audience) streamInput.audience = audience;
    if (tone) streamInput.tone = tone;
    if (length) streamInput.length = length;
    const stream = await app.stream(
      streamInput,
      { streamMode: ["values", "updates"] }
    );

    let result;
    for await (const chunk of stream) {
      const [mode, payload] = Array.isArray(chunk) ? chunk : ["values", chunk];
      if (mode === "values") {
        result = payload;
      } else if (mode === "updates" && payload && typeof payload === "object") {
        for (const nodeName of Object.keys(payload)) {
          if (nodeName !== "__metadata__" && NODE_LABEL_MAP[nodeName]) {
            d.logger.log(`✓ ${NODE_LABEL_MAP[nodeName]}`);
          }
        }
      }
    }

    if (!result?.post) {
      throw new Error(result?.rejectionReason ?? "Generation did not complete successfully");
    }

    const slug = d.slugify(result.userInput ?? userInput);
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    const imageFilename = `${timestamp}-${slug}.png`;
    const jsonFilename = `${timestamp}-${slug}.json`;

    await d.mkdir(d.POSTS_DIR, { recursive: true });

    const post = { ...result.post };
    let imageSaved = false;
    if (post.imageUrl && (await d.isUrlSafeForFetch(post.imageUrl))) {
      const isRetryable = (e) => {
        const status = e?.status ?? e?.response?.status;
        const code = e?.code ?? e?.cause?.code;
        return (
          (status >= 500 && status < 600) ||
          ["ECONNRESET", "ETIMEDOUT", "ENOTFOUND"].includes(code)
        );
      };

      for (let attempt = 0; attempt <= d.IMAGE_FETCH_RETRIES && !imageSaved; attempt++) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(
            () => controller.abort(),
            d.IMAGE_FETCH_TIMEOUT_MS
          );
          const imageResponse = await fetch(post.imageUrl, {
            signal: controller.signal
          });
          clearTimeout(timeout);
          if (!imageResponse.ok) {
            const err = new Error(`HTTP ${imageResponse.status}`);
            err.status = imageResponse.status;
            throw err;
          }
          const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
          await d.writeFile(d.join(d.POSTS_DIR, imageFilename), imageBuffer);
          post.imageFilename = imageFilename;
          post.imageAlt = post.categories?.[0] ?? "Blog illustration";
          d.logger.log(`Image saved: ${d.POSTS_DIR}/${imageFilename}`);
          imageSaved = true;
        } catch (err) {
          const lastAttempt = attempt === d.IMAGE_FETCH_RETRIES;
          if (lastAttempt || !isRetryable(err)) {
            d.logger.error(
              "Image download failed, saving post without image:",
              err.message
            );
            break;
          }
        }
      }
    }
    delete post.imageUrl;

    const jsonPath = d.join(d.POSTS_DIR, jsonFilename);
    await d.writeFile(jsonPath, JSON.stringify(post, null, 2), "utf-8");

    d.logger.log(`Blog saved: ${jsonPath}`);

    const articlesValidated = result.articles
      ? result.articles.trim().split("\n").filter(Boolean).length
      : 0;
    await metrics.finalize("success", {
      articlesValidatedCount: articlesValidated,
      articlesAttemptedCount: result.articlesAttemptedCount
    });
  } catch (err) {
    await metrics.finalize("failure", {
      failureReason: err.message
    });
    d.logger.error("Blog generation failed:", err.message);
    if (err.status ?? err.response?.status) {
      d.logger.error("API status:", err.status ?? err.response?.status);
    }
    throw err;
  }
}

/** Parses --key=value or --key value from args, returns { opts, positional }. */
function parseOpts(args) {
  const opts = {};
  const positional = [];
  const flags = [
    { name: "audience", prefixLen: 11 },
    { name: "tone", prefixLen: 7 },
    { name: "length", prefixLen: 9 }
  ];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    let matched = false;
    for (const { name, prefixLen } of flags) {
      const pref = `--${name}=`;
      if (a.startsWith(pref)) {
        opts[name] = a.slice(prefixLen).trim();
        matched = true;
        break;
      }
      if (a === `--${name}` && args[i + 1]) {
        opts[name] = args[++i].trim();
        matched = true;
        break;
      }
    }
    if (!matched && !a.startsWith("--")) {
      positional.push(a);
    }
  }
  return { opts, positional };
}

const isMain = process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);
if (isMain) {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    logger.log(USAGE);
    process.exit(0);
  }

  const { opts, positional } = parseOpts(args);
  const [userInput] = positional;
  if (!userInput) {
    logger.error(USAGE);
    process.exit(1);
  }
  if (userInput.length > MAX_USER_INPUT_LENGTH) {
    logger.error(`Question too long (max ${MAX_USER_INPUT_LENGTH} characters)`);
    process.exit(1);
  }
  if (opts.audience && opts.audience.length > MAX_AUDIENCE_LENGTH) {
    logger.error(`Audience too long (max ${MAX_AUDIENCE_LENGTH} characters)`);
    process.exit(1);
  }

  runBlogGenerator({ userInput, audience: opts.audience, tone: opts.tone, length: opts.length })
    .catch(() => {
      process.exitCode = 1;
    });
}
