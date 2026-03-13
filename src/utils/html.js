/**
 * HTML utilities: escaping, metadata extraction, moderation text, markdown.
 */

import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

marked.setOptions({ gfm: true, breaks: true });

/**
 * Converts markdown to safe HTML. Used for LLM answer body.
 * @param {string} markdown - Raw markdown text
 * @returns {string} Sanitized HTML
 */
export function markdownToHtml(markdown) {
  if (!markdown || typeof markdown !== "string") return "";
  const raw = marked.parse(markdown.trim());
  return sanitizeHtml(raw, {
    allowedTags: [
      "p", "br", "strong", "em", "code", "pre", "ul", "ol", "li",
      "blockquote", "a", "h1", "h2", "h3", "h4", "h5", "h6", "hr"
    ],
    allowedAttributes: { a: ["href", "title"], code: ["class"] },
    allowedSchemes: ["http", "https", "mailto"]
  }).trim() || "";
}

/**
 * Escapes HTML special characters to prevent XSS.
 * @param {string} text - Raw text
 * @returns {string} HTML-safe string
 */
export function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Extracts title and description metadata from HTML.
 * @param {string} html - Raw HTML
 * @returns {{ title: string, description: string }}
 */
export function extractMetadataFromHtml(html) {
  if (!html || typeof html !== "string") return { title: "", description: "" };

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch?.[1]?.replace(/<[^>]+>/g, "").trim() ?? "";

  const descMatch =
    html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']*)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["'](?:description|og:description)["']/i);
  const description = descMatch?.[1]?.trim() ?? "";

  return { title, description };
}

/**
 * Builds text for content moderation from HTML: metadata (title, description) + body.
 * Prioritizes metadata so page claims are always verified.
 * @param {string} html - Raw HTML
 * @param {number} limit - Max characters to return
 * @returns {string} Plain text for moderation
 */
export function extractTextForModeration(html, limit = 2000) {
  if (!html || typeof html !== "string") return "";

  const { title, description } = extractMetadataFromHtml(html);
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const parts = [];
  if (title) parts.push(`Title: ${title}`);
  if (description) parts.push(`Description: ${description}`);
  if (stripped) parts.push(stripped);

  const combined = parts.join("\n\n");
  return combined.slice(0, limit);
}
