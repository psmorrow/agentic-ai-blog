/**
 * State schema for the graph.
 * Tracks user input, LLM outputs, and generated content through the pipeline.
 */

import { Annotation } from "@langchain/langgraph";

/**
 * Graph state schema. Fields: userInput, audience, tone, length, finalAnswer,
 * rawAnswer, editedAnswer, formattedAnswer, verified, categories, articles,
 * articlesAttemptedCount, imageUrl, post (structured post data for JSON).
 */
export const State = Annotation.Root({
  userInput: Annotation(),
  audience: Annotation(),
  tone: Annotation(),
  length: Annotation(),
  finalAnswer: Annotation(),
  rawAnswer: Annotation(),
  editedAnswer: Annotation(),
  formattedAnswer: Annotation(),
  verified: Annotation(),
  rejectionReason: Annotation(),
  categories: Annotation(),
  articles: Annotation(),
  articlesAttemptedCount: Annotation(),
  imageUrl: Annotation(),
  post: Annotation()
});
