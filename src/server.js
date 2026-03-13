/**
 * Express server for blog feed and assets.
 * Feed (/): all posts with GA4 (page_view, post_view on viewport, article_click).
 * API /v1/posts: JSON list of post filenames.
 * Static /posts/*: images and assets.
 * Posts are stored as JSON; pages are rendered via utils/templates.js.
 * Run: node src/server.js
 * Browse: http://localhost:3000/
 * API: http://localhost:3000/v1/posts
 */

import express from "express";
import { readdir, readFile } from "fs/promises";
import { resolve } from "path";
import { fileURLToPath } from "node:url";

import { POSTS_DIR } from "./config.js";
import {
  renderPostHtml,
  buildGaScript,
  renderEmptyFeedPage,
  renderFeedPage,
  renderFeedBlock,
  renderSinglePostPage
} from "./utils/templates.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const defaultPostsPath = resolve(__dirname, "..", POSTS_DIR);

/**
 * Creates the Express app. Exported for testing.
 * @param {string} [postsPath] - Path to posts directory (default: ../posts)
 * @param {{ GA_MEASUREMENT_ID?: string }} [config] - Optional GA4 config
 * @returns {import("express").Express}
 */
export function createApp(postsPath = defaultPostsPath, config = {}) {
  const app = express();
  const gaId = config.GA_MEASUREMENT_ID ?? process.env.GA_MEASUREMENT_ID?.trim();

  /** Parses YYYY-MM-DD from filename like "2026-03-12T18-42-14-slug.json", returns Date or null. */
  function filenameToDate(name) {
    const match = name.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    const d = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
    return isNaN(d.getTime()) ? null : d;
  }

  /** Returns relative date label: "Today", "Yesterday", "N days ago", "N weeks ago", etc. */
  function toRelativeDate(date) {
    if (!date) return "";
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const then = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const days = Math.floor((today - then) / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 14) return "1 week ago";
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 60) return "1 month ago";
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    if (days < 730) return "1 year ago";
    return `${Math.floor(days / 365)} years ago`;
  }

  /** Returns sorted list of JSON post filenames (latest first), or throws on non-ENOENT errors. */
  async function getPosts() {
    try {
      const entries = await readdir(postsPath, { withFileTypes: true });
      return entries
        .filter((e) => e.isFile() && e.name.endsWith(".json"))
        .map((e) => e.name)
        .sort((a, b) => b.localeCompare(a));
    } catch (err) {
      if (err.code === "ENOENT") return [];
      throw err;
    }
  }

  const gaScript = buildGaScript(gaId);

  /** Finds the latest post filename for a given slug (e.g. "what-is-dna"). */
  async function findPostBySlug(slug) {
    const posts = await getPosts();
    const matches = posts.filter((name) => name.endsWith(`-${slug}.json`));
    return matches[0] ?? null; // posts is already sorted latest-first
  }

  // Serve /posts/* (images and assets)
  app.use(`/${POSTS_DIR}`, express.static(postsPath));

  // Single post page by slug, e.g. /posts/what-is-langgraph (after static so images load)
  app.get(`/${POSTS_DIR}/:slug`, async (req, res) => {
    try {
      const { slug } = req.params;
      const filename = await findPostBySlug(slug);
      if (!filename) {
        return res.status(404).send("Not found");
      }

      const raw = await readFile(resolve(postsPath, filename), "utf8");
      const post = JSON.parse(raw);
      const fragment = renderPostHtml(post, POSTS_DIR);
      const date = filenameToDate(filename) || new Date(0);
      const dateLabel = toRelativeDate(date);

      const html = renderSinglePostPage({ dateLabel, fragment, gaScript });
      res.type("html").send(html);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/", async (_req, res) => {
    try {
      const posts = await getPosts();
      if (posts.length === 0) {
        return res.type("html").send(renderEmptyFeedPage({ gaScript }));
      }

      const groups = new Map();
      for (const name of posts) {
        const date = filenameToDate(name) || new Date(0);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        if (!groups.has(key)) groups.set(key, { date, names: [] });
        groups.get(key).names.push(name);
      }
      const ordered = Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));

      const blocks = [];
      for (const [, { date, names }] of ordered) {
        const label = toRelativeDate(date);
        const postsData = await Promise.all(
          names.map(async (name) => {
            const raw = await readFile(resolve(postsPath, name), "utf8");
            return JSON.parse(raw);
          })
        );
        const fragments = postsData.map((p) => renderPostHtml(p, POSTS_DIR));
        blocks.push(renderFeedBlock({ label, fragments }));
      }

      const html = renderFeedPage({ blocks, gaScript });
      res.type("html").send(html);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/v1/posts", async (_req, res) => {
    try {
      const posts = await getPosts();
      res.json({ posts });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return app;
}

const app = createApp();
const port = process.env.PORT ?? 3000;

const isMain =
  process.argv[1] &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);
if (isMain) {
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}
