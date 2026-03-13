/**
 * Configuration loader and validator.
 * Loads env vars, validates required keys, and exposes app constants.
 */

import "dotenv/config";

/** App constants (timeouts, limits, directories). */
export const FETCH_TIMEOUT_MS = 5000;
export const IMAGE_FETCH_TIMEOUT_MS = 10000;
export const IMAGE_FETCH_RETRIES = 2;
export const MODERATION_TEXT_LIMIT = 10000;
export const SAFE_BROWSING_TIMEOUT_MS = 5000;
export const POSTS_DIR = "posts";
export const METRICS_DIR = "metrics";

/**
 * Loads and validates required configuration.
 * Call at app startup before creating the agent.
 * @returns {Readonly<{ OPENAI_API_KEY: string, GOOGLE_SAFE_BROWSING_API_KEY: string, SERPER_API_KEY: string, GA_MEASUREMENT_ID?: string, FETCH_TIMEOUT_MS: number, IMAGE_FETCH_TIMEOUT_MS: number, IMAGE_FETCH_RETRIES: number, MODERATION_TEXT_LIMIT: number, SAFE_BROWSING_TIMEOUT_MS: number, POSTS_DIR: string, METRICS_DIR: string }>}
 * @throws {Error} If required env vars are missing or empty
 */
export function loadConfig() {
  const openai = process.env.OPENAI_API_KEY?.trim();
  const google = process.env.GOOGLE_SAFE_BROWSING_API_KEY?.trim();
  const serper = process.env.SERPER_API_KEY?.trim();

  const missing = [];
  if (!openai) missing.push("OPENAI_API_KEY");
  if (!google) missing.push("GOOGLE_SAFE_BROWSING_API_KEY");
  if (!serper) missing.push("SERPER_API_KEY");

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  const gaId = process.env.GA_MEASUREMENT_ID?.trim();

  return Object.freeze({
    OPENAI_API_KEY: openai,
    GOOGLE_SAFE_BROWSING_API_KEY: google,
    SERPER_API_KEY: serper,
    ...(gaId && { GA_MEASUREMENT_ID: gaId }),
    FETCH_TIMEOUT_MS,
    IMAGE_FETCH_TIMEOUT_MS,
    IMAGE_FETCH_RETRIES,
    MODERATION_TEXT_LIMIT,
    SAFE_BROWSING_TIMEOUT_MS,
    POSTS_DIR,
    METRICS_DIR
  });
}
