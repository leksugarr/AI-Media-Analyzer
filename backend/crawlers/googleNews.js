/**
 * Google News RSS Crawler
 * Fetches articles via Google News RSS — supports keyword search,
 * topic browsing, and locale targeting (zh-TW default).
 *
 * Usage:
 *   import { searchGoogleNews, fetchNewsByTopic } from "./crawlers/googleNews.js"
 *   const articles = await searchGoogleNews("AI 人工智慧", { locale: "zh-TW", limit: 10 })
 */

import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";

// ─── Locale Configs ────────────────────────────────────────────────────────────
// Each locale maps to Google News RSS query params
const LOCALES = {
  "zh-TW": { hl: "zh-TW", gl: "TW", ceid: "TW:zh-Hant" },
  "zh-CN": { hl: "zh-CN", gl: "CN", ceid: "CN:zh-Hans" },
  "en-US": { hl: "en-US", gl: "US", ceid: "US:en"      },
  "ja-JP": { hl: "ja",    gl: "JP", ceid: "JP:ja"       },
};

// ─── Topic Token Map ───────────────────────────────────────────────────────────
// Google News uses opaque base64 tokens to identify topic feeds
const TOPIC_TOKENS = {
  topStories:    "CAAqJggKIiBDQkFTRWdvSUwyMHZNRFZxYUdjU0FtVnVHZ0pWVXlnQVAB",
  world:         "CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtVnVHZ0pWVXlnQVAB",
  technology:    "CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtVnVHZ0pWVXlnQVAB",
  business:      "CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TWpRU0FtVnVHZ0pWVXlnQVAB",
  science:       "CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp0Y1RjU0FtVnVHZ0pWVXlnQVAB",
  health:        "CAAqIQgKIhtDQkFTRGdvSUwyMHZNR3QwTlRFU0FtVnVIQUFQAQ",
  sports:        "CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp1ZEdvU0FtVnVHZ0pWVXlnQVAB",
  entertainment: "CAAqJggKIiBDQkFTRWdvSUwyMHZNREpxYW5RU0FtVnVHZ0pWVXlnQVAB",
};

const BASE_URL = "https://news.google.com/rss";
const DEFAULT_LOCALE = "zh-TW";
const DEFAULT_LIMIT = 20;
const REQUEST_TIMEOUT = 12000;

// ─── URL Builders ──────────────────────────────────────────────────────────────

function buildSearchUrl(keyword, localeConfig) {
  const { hl, gl, ceid } = localeConfig;
  const encoded = encodeURIComponent(keyword);
  return `${BASE_URL}/search?q=${encoded}&hl=${hl}&gl=${gl}&ceid=${ceid}`;
}

function buildTopicUrl(topicKey, localeConfig) {
  const token = TOPIC_TOKENS[topicKey];
  if (!token) {
    throw new Error(
      `Unknown topic: "${topicKey}". Valid options: ${Object.keys(TOPIC_TOKENS).join(", ")}`
    );
  }
  const { hl, gl, ceid } = localeConfig;
  return `${BASE_URL}/topics/${token}?hl=${hl}&gl=${gl}&ceid=${ceid}`;
}

// ─── RSS Fetcher & Parser ──────────────────────────────────────────────────────

async function fetchAndParseRSS(url, limit) {
  const response = await fetch(url, {
    headers: {
      // Mimic a real browser to avoid blocks
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
    timeout: REQUEST_TIMEOUT,
  });

  if (!response.ok) {
    throw new Error(`RSS fetch failed: HTTP ${response.status}`);
  }

  const xml = await response.text();

  const parsed = await parseStringPromise(xml, {
    explicitArray: false, // single child → object, not [object]
    mergeAttrs: true,     // merge XML attrs into the JS object
    trim: true,
  });

  const items = parsed?.rss?.channel?.item;
  if (!items) return [];

  // xml2js returns a plain object for 1 item, array for many — normalise
  const itemArray = Array.isArray(items) ? items : [items];

  return itemArray
    .slice(0, limit)
    .map(parseItem)
    .filter(Boolean); // discard any malformed items
}

// ─── Item Parser ───────────────────────────────────────────────────────────────

function parseItem(item) {
  try {
    const title = stripHtml(item.title || "").trim();
    const url   = item.link || (typeof item.guid === "string" ? item.guid : item.guid?._ ) || "";

    if (!title || !url) return null;

    // <source> may be a string or an object like { _: "Reuters", url: "..." }
    const source =
      typeof item.source === "object"
        ? (item.source._ ?? "")
        : (item.source ?? "");

    const publishedAt = item.pubDate ? new Date(item.pubDate) : new Date();

    // Description holds a short snippet wrapped in HTML — strip it
    const description = stripHtml(item.description || "").slice(0, 300).trim();

    return {
      title,
      url,
      source: String(source).trim(),
      description,
      publishedAt,
      fetchedAt: new Date(),
      crawlerMeta: {
        crawler: "googleNews",
      },
    };
  } catch {
    return null;
  }
}

// ─── Utility ───────────────────────────────────────────────────────────────────

function stripHtml(str) {
  return str.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Search Google News by keyword(s)
 *
 * @param {string|string[]} keywords  Single keyword or array (joined as AND query)
 * @param {object}  options
 * @param {string}  [options.locale="zh-TW"]  Locale key — "zh-TW" | "zh-CN" | "en-US" | "ja-JP"
 * @param {number}  [options.limit=20]         Max articles to return
 * @returns {Promise<object[]>}
 *
 * @example
 *   await searchGoogleNews("台積電")
 *   await searchGoogleNews(["AI", "台灣"], { locale: "zh-TW", limit: 5 })
 */
export async function searchGoogleNews(keywords, options = {}) {
  const { locale = DEFAULT_LOCALE, limit = DEFAULT_LIMIT } = options;
  const localeConfig = LOCALES[locale] ?? LOCALES[DEFAULT_LOCALE];

  const query = Array.isArray(keywords) ? keywords.join(" ") : keywords;
  if (!query?.trim()) throw new Error("keywords cannot be empty");

  const url = buildSearchUrl(query.trim(), localeConfig);
  console.log(`[GoogleNews] Search: "${query}" | locale=${locale} | url=${url}`);

  const articles = await fetchAndParseRSS(url, limit);
  console.log(`[GoogleNews] Returned ${articles.length} articles`);
  return articles;
}

/**
 * Browse Google News by topic category
 *
 * @param {string}  topic             Key from TOPIC_TOKENS: "topStories" | "technology" | "world" | ...
 * @param {object}  options
 * @param {string}  [options.locale="zh-TW"]
 * @param {number}  [options.limit=20]
 * @returns {Promise<object[]>}
 *
 * @example
 *   await fetchNewsByTopic("technology")
 *   await fetchNewsByTopic("world", { locale: "en-US", limit: 10 })
 */
export async function fetchNewsByTopic(topic = "topStories", options = {}) {
  const { locale = DEFAULT_LOCALE, limit = DEFAULT_LIMIT } = options;
  const localeConfig = LOCALES[locale] ?? LOCALES[DEFAULT_LOCALE];

  const url = buildTopicUrl(topic, localeConfig);
  console.log(`[GoogleNews] Topic: "${topic}" | locale=${locale}`);

  const articles = await fetchAndParseRSS(url, limit);
  console.log(`[GoogleNews] Returned ${articles.length} articles`);
  return articles;
}

/**
 * Resolve a Google News redirect URL → real article URL.
 * Only needed if you want to crawl full article body afterwards.
 *
 * @param {string} googleUrl
 * @returns {Promise<string>}
 */
export async function resolveGoogleNewsUrl(googleUrl) {
  try {
    const res = await fetch(googleUrl, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: REQUEST_TIMEOUT,
    });
    return res.url;
  } catch {
    return googleUrl; // return original on failure
  }
}

export const VALID_TOPICS  = Object.keys(TOPIC_TOKENS);
export const VALID_LOCALES = Object.keys(LOCALES);