# Agentic AI Blog Post Generator

Generates blog post from a question using LangGraph. Each run produces an answer tailored to your audience, professionally edited and verified, with categories, recommended articles, and an AI-generated image.

## Requirements

- Node.js 24+ (LTS)
- API keys: OpenAI, Google Safe Browsing, Serper
- Google Chrome (for `npm run test:e2e`)

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
       └→ verifiedForkNode (fan-out)
             ├→ categorizeNode              Extract topics (LLM)
             │
             ├→ articlesNode                Search web (Serper)
             │     → validateArticlesNode   SSRF, Safe Browsing, fetch, moderation
             │
             └→ imageNode                   Generate image prompt (LLM) → DALL·E
                   → validateImageNode      Moderation
             │
             └→ outputNode (fan-in)         Assemble post data; all 3 branches converge
  → END
```

After `verifyNode`, three branches run in parallel. `outputNode` waits for all three, then produces structured post data. The CLI (`index.js`) downloads the image, saves it to `posts/`, and writes JSON. The server renders posts from JSON using `templates.js`.

### State

State flows through the graph and is merged at each step. Key fields:

| Field | Description |
|-------|-------------|
| `userInput` | Question (may be edited by `editorNode`) |
| `audience`, `tone`, `length` | Optional style params |
| `finalAnswer` | Q&A from answer/editor nodes |
| `verified` | Whether `verifyNode` passed |
| `rejectionReason` | Reason when rejected |
| `categories` | Topic array (from `categorizeNode`) |
| `articles` | Validated article text (newline-separated); converted to `{ title, url }[]` in `post` |
| `articlesAttemptedCount` | Number of articles validated |
| `imageUrl` | DALL·E image URL (or null if filtered) |
| `post` | Structured post: `slug`, `title`, `bodyHtml`, `categories`, `articles`, `imageUrl`. After CLI: `imageUrl` replaced with `imageFilename`, `imageAlt` in stored JSON. |

### Post-processing (CLI)

After the graph completes, `index.js`:

1. Fetches the image from `post.imageUrl`, saves it as `{timestamp}-{slug}.png` in `posts/`
2. Adds `imageFilename` and `imageAlt` (primary category) to the post
3. Removes `imageUrl` and writes the post as `{timestamp}-{slug}.json`

### Key Design Choices

- **Conditional routing**: `verifyNode` returns `verified` or `rejected`; rejected flows route to END without throwing.
- **Verification**: `verifyNode` uses an LLM to check content policy, quality, and accuracy. On failure it sets `rejectionReason`; the user sees a generic error.
- **Articles**: Fetched via Serper, then validated (SSRF, Safe Browsing, fetch, content-type, moderation). Invalid links are dropped; the footer explains these are "relevant search results."
- **Image**: DALL·E generates a URL; `validateImageNode` runs moderation; the CLI downloads and saves locally.
- **Retries**: LLM and API nodes use an exponential backoff retry policy for transient errors.
- **Metrics**: Node timing and run outcomes are logged to `metrics/blog_runs.jsonl`.

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
    ├── logger.js      Logging (console wrapper, swappable)
    ├── metrics.js     Run metrics, node timing
    ├── search.js      Serper search wrapper
    └── urlValidation.js   SSRF checks, Google Safe Browsing
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run server` | Start feed server (http://localhost:3000) |
| `npm start -- "<question>" [--audience="..."] [--tone=...] [--length=...]` | Run the generator |
| `npm run start:help` | Show usage |
| `npm test` | Run test:lint, test:coverage, and test:e2e |
| `npm run test:coverage` | Unit tests with coverage |
| `npm run test:e2e` | Playwright e2e: routes, JSON API, rendering |
| `npm run test:e2e:ui` | Playwright e2e with UI mode |
| `npm run test:lint` | ESLint on `src/` |
| `npm run test:unit` | Run unit tests only |

## E2E Testing

Playwright tests verify routes, the JSON API, feed rendering, and single-post pages. Requires Google Chrome.

```bash
npm run test:e2e
```

Playwright starts the server automatically (or reuses one on port 3000). After a run, open the HTML report:

```bash
npx playwright show-report
```

Output: `playwright-test-results/` (traces, screenshots on failure), `playwright-report/` (HTML report).
