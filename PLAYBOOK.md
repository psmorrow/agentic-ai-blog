# AI-Assisted Feature Development Playbook

Learnings from building the Agentic AI Blog with an AI coding assistant. This playbook captures the patterns and steps that worked well.

---

## Core Principles

1. **Ask before you act** — Use the assistant for analysis and recommendations before committing to implementation.
2. **Iterate in small chunks** — Scope features narrowly; add complexity only after the basics work.
3. **Verify and clean up** — Explicitly ask for cleanup, verification, and documentation updates.
4. **Question assumptions** — Challenge design choices and ask for trade-offs when unsure.

---

## Step-by-Step Workflow

### Phase 1: Discovery and Exploration

| Step | What to do | Example prompts |
|------|------------|-----------------|
| 1.1 | Ask what's possible | "Are there other elements that the posts should include?" |
| 1.2 | Assess feasibility | "How easy is it to add a sharing button...?" |
| 1.3 | Get options compared | "Or instead of going to the exact post in the feed, we can bring back the route to show a specific post?" |
| 1.4 | Ask for UX recommendation | "From a user expectation and usage which approach provides a better user experience?" |

**Takeaway:** Don't jump to implementation. Let the assistant outline options, trade-offs, and recommendations first.

---

### Phase 2: Architectural Decisions

| Step | What to do | Example prompts |
|------|------------|-----------------|
| 2.1 | Ask for trade-offs | "Should the node add the share button or should the page when it renders add the share button?" |
| 2.2 | Ask "should we?" questions | "When creating posts, should we really create them as html fragment files? Or should they be json files?" |
| 2.3 | Request a recommendation | "What would #1 mean to the flow?" (after getting a list of options) |
| 2.4 | Confirm and commit | "Agree, make the change." / "Lets make that change." |

**Takeaway:** Use the assistant as an architect. Get a clear recommendation and rationale before changing design.

---

### Phase 3: Implementation

| Step | What to do | Example prompts |
|------|------------|-----------------|
| 3.1 | Scope narrowly at first | "Lets start this by adding a share button and menu with Facebook, Instagram, and Copy Link." |
| 3.2 | Be explicit | "The images should have a descriptive alt text which should be the same as the primary tag/category." |
| 3.3 | Use short commit phrases | "Make it so." / "Add the conditional edge logic." |
| 3.4 | Batch related work | "Lets make that change to the code. Afterward migrate the current post html files to json files." |

**Takeaway:** Clear, specific requests get better results. Start small, then expand.

---

### Phase 4: Bug Fixes and Adjustments

| Step | What to do | Example prompts |
|------|------------|-----------------|
| 4.1 | Report what you see | "Single page works but the image doesn't load." |
| 4.2 | Point to the symptom | "The share button is showing correctly, but clicking on it doesn't show the menu." |
| 4.3 | Request refinements | "Remove instagram. The alert that the post url has been copied should be an on page alert and not a browser alert." |

**Takeaway:** Describe the behavior, not the fix. Let the assistant diagnose.

---

### Phase 5: Cleanup and Hygiene

| Step | What to do | Example prompts |
|------|------------|-----------------|
| 5.1 | Ask about leftovers | "Did you delete the script after running it?" |
| 5.2 | Remove temporary tools | "Remove the script and the tools folder." |
| 5.3 | Simplify when possible | "Is rejectNode needed or can we add the END to the addConditionalEdges?" → "Please simplify the rejectNode END logic." |
| 5.4 | Revert experiments | "Remove the sharing code." (when switching approaches) |

**Takeaway:** Explicitly ask for cleanup. Don't assume the assistant will remove one-off scripts or temporary code.

---

### Phase 6: Quality and Testing

| Step | What to do | Example prompts |
|------|------------|-----------------|
| 6.1 | Target coverage | "Add unit tests for server.js to increase branch coverage above 80%." |
| 6.2 | Create tests for new modules | "Create a template.js unit test. Move template.js into the utils folder." |
| 6.3 | Fix lint issues | (assistant surfaced ESLint issues during PR prep) |

**Takeaway:** Tie test requests to concrete goals (e.g., coverage threshold) or to new files.

---

### Phase 7: Documentation and Correctness

| Step | What to do | Example prompts |
|------|------------|-----------------|
| 7.1 | Auditing | "Are all the jsdocs and comments correct, also is the readme.md file correct?" |
| 7.2 | Fix findings | "Fix the minor issues." |
| 7.3 | Keep README in sync | "Add the single route to the README.md with the other routes documented." / "Fix the readme wording." |

**Takeaway:** Do periodic doc audits. README and JSDoc drift over time.

---

### Phase 8: Refinement

| Step | What to do | Example prompts |
|------|------------|-----------------|
| 8.1 | Question naming | "Would verifiedRouter better be named as verifiedNode?" |
| 8.2 | Ask for clarification | "Is _state really unused?" (to understand before changing) |
| 8.3 | Request refactors | "Move the server html to the template.js file and rename it to templates.js." |
| 8.4 | Validate understanding | "Should the categorizeMessages also use the buildGuidanceParts?" |

**Takeaway:** Use the assistant to refine naming, structure, and consistency.

---

### Phase 9: Pre-PR Review

| Step | What to do | Example prompts |
|------|------------|-----------------|
| 9.1 | Ask for a sweep | "Any clean up to do? Any dead code? Anything dangling? Anything not complete?" |
| 9.2 | Final check | "It looks like we are ready for a PR. Any last issues that we should address?" |

**Takeaway:** Explicitly ask for a final review before opening a PR.

---

## Patterns That Worked Well

1. **Explore → Decide → Implement** — Get options, pick one, then implement.
2. **One concern per request** — Easier to review and iterate (e.g., "Add X" vs. "Add X, Y, Z, and fix W").
3. **Ask "why" and "should we"** — e.g., "In the .gitignore why are the *.log & .DS_Store entries in there?" to learn conventions.
4. **Batch migrations** — "Migrate the current post html files to json files" after a structural change.
5. **Keep layout decisions explicit** — "Should config be in root along with the env files?" before moving files.

---

## Anti-Patterns to Avoid

1. **Skipping exploration** — Implementing the first idea without comparing alternatives.
2. **Assuming cleanup** — The assistant may leave scripts, temp files, or dead code; ask explicitly.
3. **Vague requests** — "Make it better" is less effective than "Add publication date to the header."
4. **Ignoring documentation** — Docs and comments get out of date; audit them periodically.

---

## Quick Reference

| Goal | Example prompt |
|------|----------------|
| Understand options | "What are the trade-offs between X and Y?" |
| Get a recommendation | "Which approach provides better UX?" |
| Implement a feature | "Add X. Use Y for Z." |
| Fix a bug | "X works but Y doesn't." |
| Clean up | "Remove the script and the tools folder." |
| Add tests | "Add unit tests for X to reach Y% coverage." |
| Audit | "Are the JSDocs and README correct?" |
| Pre-PR | "Any last issues before we open a PR?" |
