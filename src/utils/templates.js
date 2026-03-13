/**
 * HTML templates for posts and pages.
 * Renders post data to article fragments and full page layouts for the feed and single-post views.
 */

import { escapeHtml } from "./html.js";

/**
 * Renders post data to an article HTML fragment.
 * @param {{ slug: string, title: string, bodyHtml: string, categories?: string[], articles?: { title: string, url: string }[], imageFilename?: string, imageAlt?: string, imageUrl?: string }} post - Post data from JSON
 * @param {string} [postsDir="posts"] - Base path for image URLs
 * @returns {string} HTML article fragment
 */
export function renderPostHtml(post, postsDir = "posts") {
  if (!post?.slug || !post?.title) return "";

  const categories = post.categories ?? [];
  const hasTags = categories.length > 0;
  const tagsHtml = hasTags
    ? `
      <div class="flex flex-wrap gap-2 mt-2">
        ${categories
          .map((c, i) =>
            i === 0
              ? `<span class="inline-block px-3 py-1 text-xs font-medium rounded-full bg-indigo-100 text-indigo-800">${escapeHtml(c)}</span>`
              : `<span class="inline-block px-3 py-1 text-xs font-medium rounded-full bg-slate-200 text-slate-700">${escapeHtml(c)}</span>`
          )
          .join("\n        ")}
      </div>
      `
    : "";

  const imageAlt = post.imageAlt ?? (hasTags ? categories[0] : "Blog illustration");
  const imageSrc = post.imageFilename
    ? `/${postsDir}/${post.imageFilename}`
    : post.imageUrl;
  const imageHtml = imageSrc
    ? `
    <figure class="w-full">
      <img src="${escapeHtml(imageSrc)}" alt="${escapeHtml(imageAlt)}" class="w-full h-auto object-cover" />
    </figure>
    `
    : "";

  const articles = post.articles ?? [];
  const hasArticles = articles.length > 0;
  const furtherReadingSection = hasArticles
    ? `
    <footer class="px-8 py-6 bg-slate-50 border-t border-slate-200" id="further-reading">
      <h2 class="text-lg font-semibold text-slate-800 mb-3">Further reading</h2>
      <ul class="list-disc list-inside space-y-1 text-slate-700">
        ${articles
          .map(
            (a) =>
              `<li class="mb-2"><a href="${escapeHtml(a.url)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 hover:underline" data-article-url="${escapeHtml(a.url)}">${escapeHtml(a.title)}</a></li>`
          )
          .join("\n")}
      </ul>
      <p class="mt-3 text-xs text-slate-500 font-normal">These are relevant search results that were found to be safe.</p>
    </footer>
`
    : "";

  const bodyHtml = post.bodyHtml ?? "";

  return `<article class="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden" data-post-slug="${escapeHtml(post.slug)}">
  <header class="px-8 pt-8 pb-4 border-b border-slate-200">
    <h1 class="text-2xl font-bold text-slate-800">${escapeHtml(post.title)}</h1>
    ${tagsHtml}
  </header>

  <div class="px-8 py-6">
    <div class="prose prose-slate max-w-none text-slate-700 leading-relaxed">
      ${bodyHtml}
    </div>
  </div>

  ${imageHtml}${furtherReadingSection}
</article>`;
}

/**
 * Builds the GA4 analytics script block. Returns empty string if gaId is falsy.
 * @param {string} gaId - Google Analytics 4 measurement ID
 * @returns {string} Script HTML or empty string
 */
export function buildGaScript(gaId) {
  if (!gaId) return "";
  return `<script async src="https://www.googletagmanager.com/gtag/js?id=${escapeHtml(gaId)}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${escapeHtml(gaId)}');
    gtag('event', 'page_view', { page_title: 'Agentic AI Blog' });
    var observed = new Set();
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) {
        if (!e.isIntersecting) return;
        var slug = e.target.getAttribute('data-post-slug');
        if (slug && !observed.has(slug)) { observed.add(slug); gtag('event', 'post_view', { post_slug: slug }); }
      });
    }, { threshold: 0.25 });
    document.querySelectorAll('article[data-post-slug]').forEach(function(el) { observer.observe(el); });
    document.body.addEventListener('click', function(ev) {
      var a = ev.target.closest('a[data-article-url]');
      if (!a) return;
      var slug = (a.closest('[data-post-slug]') || {}).getAttribute('data-post-slug') || '';
      gtag('event', 'article_click', { post_slug: slug, article_url: a.getAttribute('data-article-url') });
    });
  </script>`;
}

/**
 * Renders the feed page when there are no posts.
 * @param {{ gaScript: string }} opts
 * @returns {string} Full HTML document
 */
export function renderEmptyFeedPage({ gaScript }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agentic AI Blog</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-100 min-h-screen py-12 px-4">
  <main class="max-w-3xl mx-auto">
    <header class="mb-8">
      <h1 class="text-3xl font-bold text-slate-900 mb-2">Agentic AI Blog</h1>
    </header>
    <p class="text-slate-500">No posts yet.</p>
  </main>
  ${gaScript}
</body>
</html>`;
}

/**
 * Renders a feed block (date group with post fragments).
 * @param {{ label: string, fragments: string[] }} opts - label: relative date; fragments: article HTML for each post
 * @returns {string} HTML for one date block
 */
export function renderFeedBlock({ label, fragments }) {
  return `<div class="mb-10">
  <div class="text-sm font-medium text-slate-500 uppercase tracking-wide mb-4 pb-2 border-b border-slate-200">${escapeHtml(label)}</div>
  <div class="space-y-8">${fragments.join("\n")}</div>
</div>`;
}

/**
 * Renders the feed page with post blocks.
 * @param {{ blocks: string[], gaScript: string }} opts - blocks: HTML for each date group (from renderFeedBlock)
 * @returns {string} Full HTML document
 */
export function renderFeedPage({ blocks, gaScript }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agentic AI Blog</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-100 min-h-screen py-12 px-4">
  <main class="max-w-3xl mx-auto">
    <header class="mb-8">
      <h1 class="text-3xl font-bold text-slate-900 mb-2">Agentic AI Blog</h1>
    </header>
    ${blocks.join("\n")}
  </main>
  ${gaScript}
</body>
</html>`;
}

/**
 * Renders the single post page.
 * @param {{ dateLabel: string, fragment: string, gaScript: string }} opts - dateLabel: relative date (e.g. "Today"); fragment: article HTML
 * @returns {string} Full HTML document
 */
export function renderSinglePostPage({ dateLabel, fragment, gaScript }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agentic AI Post</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-100 min-h-screen py-12 px-4">
  <main class="max-w-3xl mx-auto">
    <header class="mb-8">
      <h1 class="text-3xl font-bold text-slate-900 mb-2">Agentic AI Post</h1>
    </header>
    <div class="text-sm font-medium text-slate-500 uppercase tracking-wide mb-4 pb-2 border-b border-slate-200">${escapeHtml(dateLabel)}</div>
    ${fragment}
  </main>
  ${gaScript}
</body>
</html>`;
}
