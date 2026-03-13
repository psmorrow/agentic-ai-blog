/**
 * Unit tests for content utilities.
 */

import { test } from "node:test";
import assert from "node:assert";
import {
  slugify,
  extractAnswerBody,
  extractAnswerForPrompt,
  parseEditorResponse,
  parseCategories
} from "./content.js";

test("slugify", () => {
  assert.strictEqual(slugify("What Is Photosynthesis?"), "what-is-photosynthesis");
  assert.strictEqual(slugify(""), "output");
  assert.strictEqual(slugify("  a  b  "), "a-b");
});

test("extractAnswerBody", () => {
  assert.strictEqual(extractAnswerBody("Question: Q\n\nAnswer: A"), "A");
  assert.strictEqual(extractAnswerBody(""), "");
});

test("extractAnswerForPrompt", () => {
  assert.strictEqual(
    extractAnswerForPrompt("Question: Q\n\nAnswer: Body text"),
    "Body text"
  );
});

test("parseEditorResponse", () => {
  const content = `QUESTION: Edited question?
ANSWER: Edited answer text.`;
  const parsed = parseEditorResponse(content, {
    userInput: "Original",
    finalAnswer: "Question: Original\n\nAnswer: Original answer"
  });
  assert.strictEqual(parsed.question, "Edited question?");
  assert.strictEqual(parsed.answer, "Edited answer text.");
});

test("parseEditorResponse fallbacks when no QUESTION/ANSWER", () => {
  const parsed = parseEditorResponse("", {
    userInput: "Fallback Q",
    finalAnswer: "Question: Q\n\nAnswer: Fallback A"
  });
  assert.strictEqual(parsed.question, "Fallback Q");
  assert.strictEqual(parsed.answer, "Fallback A");
});

test("parseCategories", () => {
  assert.deepStrictEqual(parseCategories("A, B, C"), ["A", "B", "C"]);
  assert.deepStrictEqual(parseCategories("A, B, C, D", 3), ["A", "B", "C"]);
  assert.deepStrictEqual(parseCategories(""), []);
});
