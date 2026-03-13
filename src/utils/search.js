/**
 * Web search for articles.
 * Builds a search query for high-quality, relevant sources targeted at the given audience.
 */

const NUM_ARTICLES = 5;

/**
 * Builds a search query for high-quality articles on the topic, targeted at the audience.
 * @param {string} topic - Topic or question
 * @param {string} [audience] - Optional audience (e.g. "sixth grader", "software engineers, grade 8 reading level")
 * @returns {string} Search query
 */
export function buildArticleSearchQuery(topic, audience) {
  let query = `${topic} high quality in-depth article`;
  if (audience) {
    query += ` for ${audience}`;
  }
  return query;
}

/**
 * Searches for articles and returns lines in the format expected by parseArticleLines.
 * @param {{ search: (opts: { q: string, num?: number }) => Promise<{ organic?: Array<{ title: string, link: string, snippet: string }> }> }} serper - Serper client
 * @param {string} topic - Topic or question
 * @param {string} [audience] - Optional audience
 * @param {number} [num] - Number of results (default 5)
 * @returns {Promise<string>} Article lines in format: "Title" - description [URL]
 */
export async function searchArticles(serper, topic, audience, num = NUM_ARTICLES) {
  const query = buildArticleSearchQuery(topic, audience);
  const result = await serper.search({ q: query, num });

  const organic = result.organic ?? [];
  return organic
    .slice(0, num)
    .filter((r) => r.link && r.title)
    .map((r) => {
      const desc = r.snippet?.trim() || "";
      const suffix = desc ? ` - ${desc}` : "";
      return `"${r.title}"${suffix} [${r.link}]`;
    })
    .join("\n");
}
