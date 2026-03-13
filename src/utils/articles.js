/**
 * Article line parsing and HTML formatting.
 */

import { escapeHtml } from "./html.js";

/**
 * Extracts an http/https URL from an article line.
 * Supports markdown [text](url) and bare (url) or [url] formats.
 * @param {string} line - Single article line
 * @returns {string | null} URL or null if none found
 */
export function extractUrlFromArticleLine(line) {
  if (!line || typeof line !== "string") return null;
  const mdLinkMatch = line.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
  const bareUrlMatch = line.match(/\((https?:\/\/[^)]+)\)|\[(https?:\/\/[^\]]+)\]/);
  return mdLinkMatch?.[2] ?? bareUrlMatch?.[1] ?? bareUrlMatch?.[2] ?? null;
}

/**
 * Parses article lines to extract URLs for validation.
 * Only returns entries with valid http/https URLs.
 * @param {string} articlesText - Raw articles from LLM
 * @returns {{ url: string, line: string }[]}
 */
export function parseArticleLines(articlesText) {
  if (!articlesText) return [];
  const lines = articlesText.trim().split("\n").filter((l) => l.trim());
  const result = [];

  for (const line of lines) {
    const url = extractUrlFromArticleLine(line);
    if (url) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
          result.push({ url, line });
        }
      } catch {
        // Invalid URL, skip
      }
    }
  }
  return result;
}

/**
 * Parses article lines into structured { title, url } objects for JSON storage.
 * @param {string} articlesText - Raw articles from LLM
 * @returns {{ title: string, url: string }[]}
 */
export function parseArticlesToStructured(articlesText) {
  if (!articlesText) return [];
  return parseArticleLines(articlesText)
    .filter(({ url }) => url)
    .map(({ url, line }) => {
      const titleMatch = line.match(/["']([^"']+)["']/);
      let title =
        titleMatch?.[1] ??
        line
          .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "")
          .replace(/\[(https?:\/\/[^\]]+)\]/g, "")
          .replace(/\((https?:\/\/[^)]+)\)/g, "")
          .replace(/^\d+\.\s*["']?/, "")
          .replace(/["']\s*-\s*/, " ")
          .replace(/\s*-\s*/, " ")
          .replace(/\s+/g, " ")
          .trim();
      if (!title) title = url;
      return { title, url };
    });
}

/**
 * Formats articles text as HTML list items with links.
 * @param {string} articlesText - Raw articles from LLM
 * @returns {string} HTML string
 */
export function formatArticlesAsHtml(articlesText) {
  if (!articlesText) return "";
  const lines = articlesText.trim().split("\n").filter((l) => l.trim());

  return lines
    .map((line) => formatArticleLine(line))
    .map((item) => `<li class="mb-2">${item}</li>`)
    .join("\n");
}

/**
 * Formats a single article line as HTML link or span.
 * @param {string} line - Raw article line
 * @returns {string} HTML string (anchor or span)
 */
function formatArticleLine(line) {
  const url = extractUrlFromArticleLine(line);

  const titleMatch = line.match(/["']([^"']+)["']/);
  let text =
    titleMatch?.[1] ??
    line
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "")
      .replace(/\[(https?:\/\/[^\]]+)\]/g, "")
      .replace(/\((https?:\/\/[^)]+)\)/g, "")
      .replace(/^\d+\.\s*["']?/, "")
      .replace(/["']\s*-\s*/, " ")
      .replace(/\s*-\s*/, " ")
      .replace(/\s+/g, " ")
      .trim();
  if (!text) text = line;

  return url
    ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 hover:underline" data-article-url="${escapeHtml(url)}">${escapeHtml(text)}</a>`
    : `<span>${escapeHtml(text)}</span>`;
}
