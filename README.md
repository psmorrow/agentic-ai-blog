# Agentic AI Blog Post Generator

Generates blog post from a question using LangGraph. Each run produces an answer tailored to your audience, professionally edited and verified, with categories, recommended articles, and an AI-generated image.

## Requirements

- Node.js 24+ (LTS)
- API keys: OpenAI, Google Safe Browsing, Serper

## Setup

```bash
git clone <repo-url>
cd agentic-ai-blog
npm install
```

Create a `.env` file in the project root:

```env
OPENAI_API_KEY=...
GOOGLE_SAFE_BROWSING_API_KEY=...
SERPER_API_KEY=...
GA_MEASUREMENT_ID=...   # Optional: Google Analytics 4
```

Configuration is loaded via `dotenv`; no extra setup needed. If `GA_MEASUREMENT_ID` is set, the feed server includes GA4 and fires `page_view`, `post_view` (when posts enter viewport), and `article_click` when users click Further reading links (see Server and Analytics sections).

## Usage

### CLI

```bash
node src/index.js "<question>" [--audience="..."] [--tone=formal|casual|technical] [--length=brief|medium|detailed]
```

Question is the only positional argument; all options use named flags.

**Examples:**

```bash
node src/index.js "What is a camshaft?"
node src/index.js "What is a camshaft?" --audience="sixth grader"
node src/index.js "What is a camshaft?" --audience="engineers" --tone=formal --length=brief
```

- **--audience**: Optional. Who the content is for; can include grade/reading level.
- **--tone**: Optional. `formal`, `casual`, or `technical`.
- **--length**: Optional. `brief`, `medium`, or `detailed`.

Output is written to `posts/` as timestamped JSON post files and PNG images. The server renders posts using a single template. Run metrics are logged to `metrics/blog_runs.jsonl`.

### Server

Run the server to browse posts in a feed:

```bash
npm run server
```

- **Feed** (`/`): List of all posts, newest first. Uses Tailwind and GA4 (if `GA_MEASUREMENT_ID` is set).
- **Single post** (`/posts/:slug`): Full-page view of one post by slug (e.g. `/posts/what-is-langgraph`). Returns 404 if not found.
- **API** (`/v1/posts`): JSON list of post filenames.
- **Assets** (`/posts/*`): Images and other static assets.

### Analytics (optional)

Set `GA_MEASUREMENT_ID` in `.env` to enable Google Analytics 4 on the feed page. Events sent:

| Event | Params | When |
|-------|--------|------|
| `page_view` | `page_title` | Feed page load |
| `post_view` | `post_slug` | Post enters viewport |
| `article_click` | `post_slug`, `article_url` | User clicks a Further reading link |

View in [Google Analytics](https://analytics.google.com) under Reports → Engagement → Events.

### Programmatic

```javascript
import { runBlogGenerator } from "./src/index.js";

await runBlogGenerator({
  userInput: "What is photosynthesis?",
  audience: "middle school students",
  tone: "casual",
  length: "medium"
});
```

## Architecture

The pipeline is implemented as a **LangGraph** state graph: a directed graph of nodes that share state. LangGraph handles scheduling, streaming, retries, and state merging.

### Graph Flow

```
START
  → answerNode      Generate answer (LLM)
  → editorNode      Edit for grammar/style (LLM)
  → verifyNode      Verify safe & relevant (LLM)
       │
       │  conditional:
       │  verified → verifiedForkNode
       │  rejected → END
       │
       └→ verifiedForkNode
             ├→ categorizeNode        Extract topics (LLM)
             │
             ├→ articlesNode          Search web (Serper)
             │     → validateArticlesNode   SSRF, Safe Browsing, moderation
             │
             └→ imageNode             Generate image prompt (LLM) → DALL·E
                   → validateImageNode      Moderation
             │
             └→ outputNode    Assemble post data (all branches fan-in)
  → END
```

After `verifyNode`, three branches run in parallel. `outputNode` waits for all three, then produces structured post data (JSON) written to `posts/`. The server renders posts from JSON using a single template.

### State

State flows through the graph and is merged at each step. Key fields:

| Field | Description |
|-------|-------------|
| `userInput` | Question (may be edited by `editorNode`) |
| `audience`, `tone`, `length` | Optional style params |
| `finalAnswer` | Q&A from answer/editor nodes |
| `categories` | Comma-separated topics |
| `articles` | Validated "Further reading" links |
| `imageUrl` | DALL·E image URL (or null if filtered) |
| `post` | Structured post data (slug, title, bodyHtml, categories, articles, imageUrl) for JSON storage |

### Key Design Choices

- **Verification**: `verifyNode` uses an LLM to check content policy, quality, and accuracy. On failure it logs the category and reason; the user sees a generic error.
- **Articles**: Fetched via Serper, then validated (SSRF, Safe Browsing, fetch, content-type, moderation). Invalid links are dropped; the footer explains these are "relevant search results."
- **Retries**: LLM and API nodes use an exponential backoff retry policy for transient errors.

## Project Structure

```
src/
├── config.js          Load env, validate keys
├── index.js           CLI entry, runBlogGenerator, writes JSON posts to posts/
├── server.js          Express feed server, API /v1/posts, renders posts from JSON
├── graph/
│   ├── index.js       createAgent (wires LLM, OpenAI, Serper, graph)
│   ├── graph.js       LangGraph definition (nodes, edges)
│   ├── state.js       State schema
│   ├── nodes.js       Node implementations
│   └── prompts.js     LLM prompt templates
└── utils/
    ├── articles.js    Parse/format article lines
    ├── content.js     Slugify, extract answer, parse editor/categories
    ├── templates.js   Post fragments and page layouts (JSON → HTML)
    ├── html.js        escapeHtml, extract text for moderation
    ├── metrics.js     Run metrics, node timing
    ├── search.js      Serper search wrapper
    └── urlValidation.js   SSRF checks, Google Safe Browsing
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm start -- "<question>" [--audience="..."] [--tone=...] [--length=...]` | Run the generator |
| `npm run start:help` | Show usage |
| `npm run server` | Start feed server (http://localhost:3000) |
| `npm test` | Run unit tests |
| `npm run test:coverage` | Tests with coverage |
| `npm run lint` | ESLint on `src/` |
