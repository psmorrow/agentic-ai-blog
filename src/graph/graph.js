/**
 * Graph definition.
 * Builds the StateGraph with all nodes and edges.
 */

import { StateGraph, START, END } from "@langchain/langgraph";
import { withNodeTiming } from "../utils/metrics.js";
import { State } from "./state.js";
import { createNodes } from "./nodes.js";

const RETRYABLE_STATUSES = [429, 500, 502, 503];
const RETRYABLE_CODES = ["ECONNRESET", "ETIMEDOUT", "ENOTFOUND"];

/** Exported for unit testing retryOn logic. */
export const apiRetryPolicy = {
  maxAttempts: 2,
  initialInterval: 1000,
  retryOn: (e) => {
    const status = e?.status ?? e?.response?.status;
    const code = e?.code ?? e?.cause?.code;
    return (
      RETRYABLE_STATUSES.includes(status) || RETRYABLE_CODES.includes(code)
    );
  }
};

/**
 * Creates and compiles the graph.
 * @param {{ llm: import("@langchain/openai").ChatOpenAI, openai: import("openai").default, config: ReturnType<import("../config.js").loadConfig>, serper: import("serper").Serper, metricsCollector?: { recordNodeDuration: (name: string, seconds: number) => void } }} deps
 * @returns {ReturnType<import("@langchain/langgraph").StateGraph["compile"]>}
 */
export function createGraph({ llm, openai, config, serper, metricsCollector }) {
  const nodes = createNodes({ llm, openai, config, serper });

  const wrap = (name, fn) =>
    metricsCollector
      ? withNodeTiming(name, fn, (n, s) => metricsCollector.recordNodeDuration(n, s))
      : fn;

  const graph = new StateGraph(State)
    .addNode("answerNode", wrap("answerNode", nodes.answerNode), {
      retryPolicy: apiRetryPolicy
    })
    .addNode("editorNode", wrap("editorNode", nodes.editorNode), {
      retryPolicy: apiRetryPolicy
    })
    .addNode("formatNode", wrap("formatNode", nodes.formatNode), {
      retryPolicy: apiRetryPolicy
    })
    .addNode("verifyNode", wrap("verifyNode", nodes.verifyNode), {
      retryPolicy: apiRetryPolicy
    })
    .addNode("verifiedForkNode", wrap("verifiedForkNode", nodes.verifiedForkNode))
    .addNode("categorizeNode", wrap("categorizeNode", nodes.categorizeNode), {
      retryPolicy: apiRetryPolicy
    })
    .addNode("articlesNode", wrap("articlesNode", nodes.articlesNode), {
      retryPolicy: apiRetryPolicy
    })
    .addNode(
      "validateArticlesNode",
      wrap("validateArticlesNode", nodes.validateArticlesNode),
      { retryPolicy: apiRetryPolicy }
    )
    .addNode("imageNode", wrap("imageNode", nodes.imageNode), {
      retryPolicy: apiRetryPolicy
    })
    .addNode(
      "validateImageNode",
      wrap("validateImageNode", nodes.validateImageNode),
      { retryPolicy: apiRetryPolicy }
    )
    .addNode("outputNode", wrap("outputNode", nodes.outputNode))
    // Flow: START -> answer -> editor -> format -> verify
    // Conditional: verifyNode -> verified ? verifiedForkNode (fan-out) : END
    // Fan-out: verifiedForkNode runs categorizeNode, articlesNode, imageNode in parallel
    // Fan-in: outputNode runs when all three branches complete
    //
    //   verifyNode --conditional->
    //     verified: verifiedForkNode
    //       ├→ categorizeNode ───────────────────────┐
    //       ├→ articlesNode → validateArticlesNode ──┼→ outputNode → END
    //       └→ imageNode → validateImageNode ────────┘
    //     rejected: END
    //
    .addEdge(START, "answerNode")
    .addEdge("answerNode", "editorNode")
    .addEdge("editorNode", "formatNode")
    .addEdge("formatNode", "verifyNode")
    // Check if the answer is verified or rejected
    .addConditionalEdges(
      "verifyNode",
      (state) => (state.verified ? "verified" : "rejected"),
      { verified: "verifiedForkNode", rejected: END }
    )
    .addEdge("verifiedForkNode", "categorizeNode")
    .addEdge("verifiedForkNode", "articlesNode")
    .addEdge("verifiedForkNode", "imageNode")
    // Articles and image pipelines
    .addEdge("articlesNode", "validateArticlesNode")
    .addEdge("imageNode", "validateImageNode")
    // Fan-in to outputNode (runs when all three branches complete)
    .addEdge("categorizeNode", "outputNode")
    .addEdge("validateArticlesNode", "outputNode")
    .addEdge("validateImageNode", "outputNode")
    .addEdge("outputNode", END);

  return graph.compile();
}
