/**
 * Graph node implementations.
 * Nodes are created via createNodes() for dependency injection (testability).
 */

import { PROMPTS } from "./prompts.js";
import { extractTextForModeration, markdownToHtml } from "../utils/html.js";
import { parseArticleLines, parseArticlesToStructured } from "../utils/articles.js";
import { searchArticles } from "../utils/search.js";
import {
  extractAnswerBody,
  extractAnswerForPrompt,
  parseEditorResponse,
  parseCategories,
  slugify
} from "../utils/content.js";
import {
  isUrlSafeForFetch,
  isUrlSafeByGoogleSafeBrowsing
} from "../utils/urlValidation.js";
import { logger } from "../utils/logger.js";
import { FETCH_TIMEOUT_MS, MODERATION_TEXT_LIMIT } from "../config.js";

/**
 * Creates node handlers with injected dependencies.
 * @param {{ llm: import("@langchain/openai").ChatOpenAI, openai: import("openai").default, config: ReturnType<import("../config.js").loadConfig>, serper: import("serper").Serper }} deps
 * @returns {Record<string, (state: object) => Promise<object>>}
 */
export function createNodes({ llm, openai, config, serper }) {
  return {
    async answerNode(state) {
      const messages = PROMPTS.answerMessages(
        state.userInput,
        state.audience,
        state.tone,
        state.length
      );
      const response = await llm.invoke(messages);

      const finalAnswer = `Question: ${state.userInput}\n\nAnswer: ${response.content}`;

      return {
        finalAnswer,
        rawAnswer: finalAnswer
      };
    },

    async editorNode(state) {
      const answerBody = extractAnswerForPrompt(state.finalAnswer);
      const messages = PROMPTS.editorMessages(
        state.userInput,
        answerBody,
        state.audience,
        state.tone,
        state.length
      );
      const response = await llm.invoke(messages);

      const { question, answer } = parseEditorResponse(response.content, {
        userInput: state.userInput,
        finalAnswer: state.finalAnswer
      });

      const finalAnswer = `Question: ${question}\n\nAnswer: ${answer}`;

      return {
        userInput: question,
        finalAnswer,
        editedAnswer: finalAnswer
      };
    },

    async formatNode(state) {
      const answerBody = extractAnswerBody(state.finalAnswer);
      const messages = PROMPTS.formatMessages(state.userInput, answerBody);
      const response = await llm.invoke(messages);

      const formattedAnswerBody = response.content;
      const finalAnswer = `Question: ${state.userInput}\n\nAnswer: ${formattedAnswerBody}`;

      return {
        finalAnswer,
        formattedAnswer: finalAnswer
      };
    },

    async verifyNode(state) {
      const messages = PROMPTS.verifyMessages(state.userInput, state.finalAnswer);
      const response = await llm.invoke(messages);

      const raw = response.content.trim();
      const verification = raw.toUpperCase();
      const verified = verification.startsWith("VERIFIED");

      if (!verified) {
        const knownCategories = ["CONTENT_POLICY", "QUALITY", "ACCURACY"];
        const rejectedMatch = raw.match(/^REJECTED:\s*(CONTENT_POLICY|QUALITY|ACCURACY):\s*(.+)$/i)
          ?? raw.match(/^REJECTED:\s*(.+)$/i);
        const category = rejectedMatch && knownCategories.includes(rejectedMatch[1]?.toUpperCase())
          ? rejectedMatch[1].toUpperCase()
          : "UNKNOWN";
        const reasonRaw = rejectedMatch?.[2] ?? rejectedMatch?.[1] ?? raw.replace(/^REJECTED:\s*/i, "");
        const reason = (String(reasonRaw || "").trim() || "Verification failed");
        logger.error(`Verification failed [${category}]:`, reason);
        return { verified: false, rejectionReason: "Answer could not be verified." };
      }

      return { verified: true };
    },

    async verifiedForkNode(_state) {
      return {};
    },

    async categorizeNode(state) {
      const messages = PROMPTS.categorizeMessages(state.userInput, state.finalAnswer);
      const response = await llm.invoke(messages);

      return { categories: parseCategories(response.content, 3) };
    },

    async articlesNode(state) {
      const articles = await searchArticles(
        serper,
        state.userInput,
        state.audience,
        5
      );
      return { articles };
    },

    async validateArticlesNode(state) {
      const parsed = parseArticleLines(state.articles);
      const kept = [];

      if (parsed.length === 0) {
        logger.error("Article validation: no articles to validate (search returned none or unparseable)");
      }

      const safeBrowsingKey = config.GOOGLE_SAFE_BROWSING_API_KEY;
      if (!safeBrowsingKey) {
        throw new Error("GOOGLE_SAFE_BROWSING_API_KEY is not set");
      }

      for (const { url, line } of parsed) {
        try {
          if (!(await isUrlSafeForFetch(url))) {
            logger.error(`Article skipped (SSRF/unsafe URL): ${url}`);
            continue;
          }

          if (!(await isUrlSafeByGoogleSafeBrowsing(url, safeBrowsingKey))) {
            logger.error(`Article skipped (Safe Browsing threat): ${url}`);
            continue;
          }

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

          const res = await fetch(url, {
            signal: controller.signal,
            headers: {
              "User-Agent":
                "Mozilla/5.0 (compatible; BlogPostValidator/1.0)"
            }
          });
          clearTimeout(timeout);

          if (!res.ok) {
            logger.error(`Article skipped (HTTP ${res.status}): ${url}`);
            continue;
          }

          const contentType = res.headers.get("content-type") ?? "";
          if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
            logger.error(`Article skipped (unsupported content-type): ${url}`);
            continue;
          }

          const body = await res.text();
          const text = extractTextForModeration(body, MODERATION_TEXT_LIMIT);
          if (!text) {
            logger.error(`Article skipped (no extractable text): ${url}`);
            continue;
          }

          const mod = await openai.moderations.create({ input: text });
          if (mod.results?.[0]?.flagged) {
            logger.error(`Article skipped (content moderation flagged): ${url}`);
            continue;
          }

          kept.push(line);
        } catch (err) {
          logger.error(`Article validation skipped (${url}):`, err.message);
        }
      }

      const validated = kept.join("\n");
      if (parsed.length > 0 && kept.length === 0) {
        logger.error(
          `Article validation: all ${parsed.length} article(s) failed validation`
        );
      }
      return {
        articles: validated,
        articlesAttemptedCount: parsed.length
      };
    },

    async imageNode(state) {
      const messages = PROMPTS.imagePromptMessages(
        state.userInput,
        state.audience,
        state.tone,
        state.length
      );
      const promptResponse = await llm.invoke(messages);

      const imagePrompt = promptResponse.content.trim();
      const imageResponse = await openai.images.generate({
        model: "dall-e-3",
        prompt: imagePrompt,
        size: "1792x1024",
        quality: "standard",
        style: "natural",
        response_format: "url"
      });

      const url = imageResponse.data?.[0]?.url ?? null;
      return { imageUrl: url };
    },

    async validateImageNode(state) {
      const imageUrl = state.imageUrl;
      if (!imageUrl) return {};

      try {
        const mod = await openai.moderations.create({
          input: [{ type: "image_url", image_url: { url: imageUrl } }],
          model: "omni-moderation-latest"
        });
        if (mod.results?.[0]?.flagged) {
          return { imageUrl: null };
        }
        return {};
      } catch (err) {
        logger.error("Image moderation failed, excluding image:", err.message);
        return { imageUrl: null };
      }
    },

    async outputNode(state) {
      const answerBody = extractAnswerBody(state.finalAnswer);
      const bodyHtml = markdownToHtml(answerBody);
      const categories = state.categories ?? [];
      const postSlug = slugify(state.userInput);
      const articles = parseArticlesToStructured(state.articles);

      const post = {
        slug: postSlug,
        title: state.userInput,
        bodyHtml,
        categories,
        articles,
        imageUrl: state.imageUrl ?? null
      };

      return { post };
    }
  };
}
