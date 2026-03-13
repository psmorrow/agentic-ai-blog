/**
 * Content parsing: slugs, answers, editor response, categories.
 */

/**
 * Converts text to a URL-safe slug (lowercase, hyphens, max 80 chars).
 * @param {string} text - Raw text
 * @returns {string} Slug
 */
export function slugify(text) {
  if (!text) return "output";
  return String(text)
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "output";
}

/**
 * Extracts the answer body from the finalAnswer format "Question: X\n\nAnswer: Y"
 * @param {string} finalAnswer - Full Q&A string
 * @returns {string} Answer content only
 */
export function extractAnswerBody(finalAnswer) {
  if (!finalAnswer) return "";
  const match = finalAnswer.match(/Answer:\s*([\s\S]*)/);
  return match ? match[1].trim() : finalAnswer;
}

/**
 * Extracts the answer section from finalAnswer for use in prompts.
 * @param {string} finalAnswer - Full Q&A string
 * @returns {string} Answer content only
 */
export function extractAnswerForPrompt(finalAnswer) {
  if (!finalAnswer) return "";
  return finalAnswer.replace(/^Question:[\s\S]*?Answer:\s*/i, "").trim();
}

/**
 * Parses the editor's structured response.
 * @param {string} content - Raw editor response
 * @param {{ userInput: string, finalAnswer: string }} fallbacks - Default values if parsing fails
 * @returns {{ question: string, answer: string }}
 */
export function parseEditorResponse(content, fallbacks) {
  const trimmed = content?.trim() ?? "";
  const questionMatch = trimmed.match(/QUESTION:\s*([\s\S]*?)(?=ANSWER:)/i);
  const answerMatch = trimmed.match(/ANSWER:\s*([\s\S]*)/i);
  return {
    question: questionMatch?.[1]?.trim() ?? fallbacks.userInput,
    answer: answerMatch?.[1]?.trim() ?? extractAnswerBody(fallbacks.finalAnswer)
  };
}

/**
 * Parses categories from comma-separated LLM output.
 * @param {string} content - Raw response
 * @param {number} max - Maximum categories to return
 * @returns {string[]}
 */
export function parseCategories(content, max = 3) {
  if (!content) return [];
  return content
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, max);
}
