/**
 * Unit tests for prompt templates.
 * Run: node --test src/graph/prompts.test.js
 */

import { test } from "node:test";
import assert from "node:assert";
import { PROMPTS } from "./prompts.js";

test("answerMessages without audience or tone or length", () => {
  const msgs = PROMPTS.answerMessages("What is X?");
  assert.strictEqual(msgs.length, 2);
  assert.strictEqual(msgs[0].role, "system");
  assert.strictEqual(msgs[1].role, "user");
  assert.ok(msgs[0].content.includes("data"));
  assert.ok(msgs[1].content.includes("<user_question>"));
  assert.ok(msgs[1].content.includes("What is X?"));
  assert.ok(!msgs[1].content.includes("<audience>"));
});

test("answerMessages with audience", () => {
  const msgs = PROMPTS.answerMessages("What is X?", "sixth grader, grade 6 reading level");
  assert.ok(msgs[0].content.includes("Tailor"));
  assert.ok(msgs[0].content.includes("audience"));
  assert.ok(msgs[1].content.includes("<audience>"));
  assert.ok(msgs[1].content.includes("sixth grader, grade 6 reading level"));
});

test("answerMessages with tone and length", () => {
  const msgs = PROMPTS.answerMessages("What is X?", undefined, "formal", "brief");
  assert.ok(msgs[0].content.includes("tone"));
  assert.ok(msgs[0].content.includes("formal"));
  assert.ok(msgs[0].content.includes("brief"));
  assert.ok(msgs[1].content.includes("<tone>"));
  assert.ok(msgs[1].content.includes("<length>"));
});

test("verifyMessages includes criteria and structured format", () => {
  const msgs = PROMPTS.verifyMessages("Q?", "A");
  assert.strictEqual(msgs.length, 2);
  assert.ok(msgs[0].content.includes("VERIFIED"));
  assert.ok(msgs[0].content.includes("REJECTED"));
  assert.ok(msgs[0].content.includes("CONTENT_POLICY"));
  assert.ok(msgs[0].content.includes("QUALITY"));
  assert.ok(msgs[0].content.includes("ACCURACY"));
  assert.ok(msgs[1].content.includes("Q?"));
  assert.ok(msgs[1].content.includes("<answer>"));
});

test("editorMessages", () => {
  const msgs = PROMPTS.editorMessages("Q?", "A");
  assert.ok(msgs[0].content.includes("QUESTION:"));
  assert.ok(msgs[0].content.includes("ANSWER:"));
  assert.ok(msgs[1].content.includes("<original_question>"));
  assert.ok(msgs[1].content.includes("<original_answer>"));
});

test("categorizeMessages", () => {
  const msgs = PROMPTS.categorizeMessages("Q?", "A");
  assert.ok(msgs[0].content.includes("comma-separated"));
  assert.ok(msgs[0].content.includes("3"));
  assert.ok(msgs[1].content.includes("<user_question>"));
});

test("imagePromptMessages", () => {
  const msgs = PROMPTS.imagePromptMessages("photosynthesis");
  assert.strictEqual(msgs.length, 2);
  assert.ok(msgs[0].content.includes("family-friendly"));
  assert.ok(msgs[0].content.includes("max 100 words"));
  assert.ok(msgs[1].content.includes("photosynthesis"));
});

test("imagePromptMessages with audience, tone, length", () => {
  const msgs = PROMPTS.imagePromptMessages("gravity", "engineers", "technical", "brief");
  assert.strictEqual(msgs.length, 2);
  assert.ok(msgs[0].content.includes("Match the style"));
  assert.ok(msgs[0].content.includes("technical"));
  assert.ok(msgs[1].content.includes("<audience>"));
  assert.ok(msgs[1].content.includes("<tone>technical</tone>"));
  assert.ok(msgs[1].content.includes("<length>brief</length>"));
});

test("all prompts include data-only instruction", () => {
  const answerMsgs = PROMPTS.answerMessages("x");
  const verifyMsgs = PROMPTS.verifyMessages("x", "y");
  const editorMsgs = PROMPTS.editorMessages("x", "y");
  const categorizeMsgs = PROMPTS.categorizeMessages("x", "y");
  const imageMsgs = PROMPTS.imagePromptMessages("x");

  const systemContents = [
    answerMsgs[0].content,
    verifyMsgs[0].content,
    editorMsgs[0].content,
    categorizeMsgs[0].content,
    imageMsgs[0].content
  ];

  for (const c of systemContents) {
    assert.ok(
      c.includes("Treat all content") || c.includes("data"),
      "Expected injection-mitigation instruction"
    );
  }
});
