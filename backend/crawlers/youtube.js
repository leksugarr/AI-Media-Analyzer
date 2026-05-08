/**
 * YouTube Crawler
 * Fetches videos via YouTube Data API v3 — supports keyword search
 * and channel browsing. Stores as Articles with crawler: "youtube".
 *
 * Usage:
 *   import { searchYouTube } from "./crawlers/youtube.js"
 *   const videos = await searchYouTube("台積電", { limit: 10 })
 */

import fetch from "node-fetch";

const BASE_URL        = "https://www.googleapis.com/youtube/v3";
const DEFAULT_LIMIT   = 20;
const REQUEST_TIMEOUT = 12000;

// ─── Item Parser ───────────────────────────────────────────────────────────────

function parseVideo(item, keyword = "") {
    try {
    const videoId = item.id?.videoId;
    if (!videoId) return null;

    const snippet = item.snippet || {};
    const title   = (snippet.title || "").trim();
    if (!title) return null;

    const url         = `https://www.youtube.com/watch?v=${videoId}`;
    const description = (snippet.description || "").slice(0, 300).trim();
    const source      = snippet.channelTitle ? `YouTube/${snippet.channelTitle}` : "YouTube";
    const publishedAt = snippet.publishedAt ? new Date(snippet.publishedAt) : new Date();
    const thumbnail   = snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || null;

    return {
      title,
      url,
      source,
      description,
      content:     thumbnail ? `[Thumbnail: ${thumbnail}]` : null,
      crawler:     "youtube",
      keywords: keyword ? [keyword] : [],
        locale:      detectLocale(snippet.defaultAudioLanguage || snippet.defaultLanguage),
      publishedAt,
      fetchedAt:   new Date(),
    };
  } catch {
    return null;
  }
}

function detectLocale(lang) {
  if (!lang) return "zh-TW";
  if (lang.startsWith("zh")) return "zh-TW";
  if (lang.startsWith("en")) return "en-US";
  return "zh-TW";
}

// ─── Core Fetcher ──────────────────────────────────────────────────────────────

async function youtubeSearch(params) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error("YOUTUBE_API_KEY not set in .env");

  const qs = new URLSearchParams({
    part:       "snippet",
    type:       "video",
    maxResults: String(Math.min(params.limit || DEFAULT_LIMIT, 50)),
    key:        apiKey,
    ...params,
  });
  // remove our custom limit key — not a YouTube param
  qs.delete("limit");

  const url = `${BASE_URL}/search?${qs.toString()}`;
  console.log(`[YouTube] Fetching: ${url.replace(apiKey, "***")}`);

  const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT) });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`YouTube API error: ${err?.error?.message || res.status}`);
  }

  const data = await res.json();
  return (data.items || []).map(item => parseVideo(item, params.q || "")).filter(Boolean);
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Search YouTube by keyword.
 *
 * @param {string} keyword
 * @param {object} options
 * @param {number} [options.limit=20]       Max videos (max 50)
 * @param {string} [options.locale="zh-TW"] Affects relevanceLanguage param
 * @param {"date"|"relevance"|"viewCount"} [options.order="relevance"]
 * @returns {Promise<object[]>}
 *
 * @example
 *   await searchYouTube("台積電", { limit: 10 })
 *   await searchYouTube("AI news", { locale: "en-US", order: "date" })
 */
export async function searchYouTube(keyword, options = {}) {
  const { limit = DEFAULT_LIMIT, locale = "zh-TW", order = "relevance" } = options;
  if (!keyword?.trim()) throw new Error("keyword cannot be empty");

  const langCode = locale.startsWith("zh") ? "zh-TW" : "en";

  const results = await youtubeSearch({
    q:                 keyword.trim(),
    relevanceLanguage: langCode,
    order,
    limit,
  });

  console.log(`[YouTube] Search "${keyword}" returned ${results.length} videos`);
  return results;
}

/**
 * Fetch latest videos from a specific YouTube channel.
 *
 * @param {string} channelId  YouTube channel ID (starts with UC...)
 * @param {object} options
 * @param {number} [options.limit=20]
 * @returns {Promise<object[]>}
 *
 * @example
 *   await fetchYouTubeChannel("UCxxxxxx", { limit: 10 })
 */
export async function fetchYouTubeChannel(channelId, options = {}) {
  const { limit = DEFAULT_LIMIT } = options;
  if (!channelId?.trim()) throw new Error("channelId cannot be empty");

  const results = await youtubeSearch({
    channelId: channelId.trim(),
    order:     "date",
    limit,
  });

  console.log(`[YouTube] Channel "${channelId}" returned ${results.length} videos`);
  return results;
}