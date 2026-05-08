/**
 * Dcard Crawler — RSS-based (avoids 403 on direct API)
 */
import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";

const REQUEST_TIMEOUT = 12000;
const DEFAULT_LIMIT   = 20;

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/rss+xml, application/xml, text/xml, */*",
  "Referer": "https://www.dcard.tw/",
};

// Dcard provides RSS feeds per forum
const FORUM_RSS = {
  trending:    "https://www.dcard.tw/rss",
  technology:  "https://www.dcard.tw/f/technology/rss",
  politics:    "https://www.dcard.tw/f/politics/rss",
  finance:     "https://www.dcard.tw/f/finance/rss",
  talk:        "https://www.dcard.tw/f/talk/rss",
  relationship:"https://www.dcard.tw/f/relationship/rss",
  job:         "https://www.dcard.tw/f/job/rss",
  taiwan:      "https://www.dcard.tw/f/taiwan/rss",
  womentalk:   "https://www.dcard.tw/f/womentalk/rss",
};

function stripHtml(str) {
  return (str || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

async function fetchRSS(url, limit) {
    const res = await fetch(url, {
    headers: HEADERS,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });
    
  if (!res.ok) throw new Error(`Dcard RSS error: HTTP ${res.status} — ${url}`);

  const xml  = await res.text();
  const parsed = await parseStringPromise(xml, { explicitArray: false, mergeAttrs: true, trim: true });

  const items = parsed?.rss?.channel?.item;
  if (!items) return [];

  const arr = Array.isArray(items) ? items : [items];
  return arr.slice(0, limit).map(parseItem).filter(Boolean);
}

function parseItem(item) {
  try {
    const title = stripHtml(item.title || "").trim();
    const url   = typeof item.link === "string" ? item.link.trim()
                : (item.guid?._ || item.guid || "");
    if (!title || !url) return null;

    const source      = item["dc:creator"] ? `Dcard/${item["dc:creator"]}` : "Dcard";
    const description = stripHtml(item.description || "").slice(0, 300).trim();
    const publishedAt = item.pubDate ? new Date(item.pubDate) : new Date();

    // Extract forum from URL: /f/{forum}/p/{id}
    const forumMatch = url.match(/\/f\/([^/]+)\//);
    const forum      = forumMatch?.[1] || "dcard";

    return {
      title,
      url,
      source:      `Dcard/${forum}`,
      description,
      content:     null,
      crawler:     "dcard",
      keywords:    [],
      locale:      "zh-TW",
      publishedAt,
      fetchedAt:   new Date(),
    };
  } catch {
    return null;
  }
}

/**
 * Fetch posts from a Dcard forum via RSS.
 * @param {string} forum  Key from FORUM_RSS (default: "trending")
 * @param {object} options
 * @param {number} [options.limit=20]
 */
export async function fetchDcardByForum(forum = "trending", options = {}) {
  const { limit = DEFAULT_LIMIT } = options;
  const url = FORUM_RSS[forum] ?? FORUM_RSS.trending;

  console.log(`[Dcard] Forum: "${forum}" | url=${url}`);
  const results = await fetchRSS(url, limit);
  console.log(`[Dcard] Returned ${results.length} posts`);
  return results;
}

/**
 * Search Dcard by keyword — filters RSS results by title/description match.
 * (Dcard has no public search RSS, so we fetch trending and filter locally)
 * @param {string} keyword
 * @param {object} options
 * @param {number} [options.limit=20]
 */
export async function searchDcard(keyword, options = {}) {
  const { limit = DEFAULT_LIMIT } = options;
  if (!keyword?.trim()) throw new Error("keyword cannot be empty");

  console.log(`[Dcard] Search: "${keyword}"`);
  const all = await fetchRSS(FORUM_RSS.trending, 30);
  const kw  = keyword.toLowerCase();
  const results = all
    .filter(p => p.title.toLowerCase().includes(kw) || p.description.toLowerCase().includes(kw))
    .slice(0, limit);

  console.log(`[Dcard] Search returned ${results.length} posts`);
  return results;
}

export const VALID_FORUMS = Object.keys(FORUM_RSS);