/**
 * Generates blog post from a question.
 *
 * Exports createAgent for programmatic use.
 * Run via: node src/index.js
 */

import { Serper } from "serper";
import { ChatOpenAI } from "@langchain/openai";
import OpenAI from "openai";
import { loadConfig } from "../config.js";
import { createGraph } from "./graph.js";

/** Default LLM configuration */
const DEFAULT_LLM_CONFIG = {
  model: "gpt-4o-mini",
  temperature: 0
};

/**
 * Creates a configured blog agent.
 * @param {{ config?: ReturnType<import("../config.js").loadConfig>, llm?: import("@langchain/openai").ChatOpenAI, openai?: import("openai").default, serper?: import("serper").Serper, metricsCollector?: { recordNodeDuration: (name: string, seconds: number) => void } }} options
 * @returns {ReturnType<typeof createGraph>}
 */
export function createAgent(options = {}) {
  const config = options.config ?? loadConfig();
  const llm =
    options.llm ??
    new ChatOpenAI({ ...DEFAULT_LLM_CONFIG, apiKey: config.OPENAI_API_KEY });
  const openai = options.openai ?? new OpenAI({ apiKey: config.OPENAI_API_KEY });
  const serper =
    options.serper ??
    new Serper({ apiKey: config.SERPER_API_KEY, cache: false });

  return createGraph({
    llm,
    openai,
    config,
    serper,
    metricsCollector: options.metricsCollector
  });
}
