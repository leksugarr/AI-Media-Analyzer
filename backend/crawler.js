import fetch from "node-fetch";
import * as cheerio from "cheerio";
import cron from "node-cron";
import Groq from "groq-sdk";
import { searchGoogleNews, fetchNewsByTopic } from "./crawlers/googleNews.js";
import { Article, Report } from "./db.js";

// ─── Groq Sentiment ────────────────────────────────────────────────────────────
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function analyzeSentiment(text) {
  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 20,
    messages: [
      {
        role: "system",
        content: `Classify sentiment. Reply ONLY with JSON: {"label":"POSITIVE"|"NEGATIVE"|"NEUTRAL","score":0.0}`,
      },
      { role: "user", content: text.slice(0, 200) },
    ],
  });
  const raw = completion.choices[0].message.content.trim();
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[^}]+\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error(`Unparseable sentiment response: ${raw}`);
  }
}

/**
 * Run sentiment on all unanalyzed articles (up to limit).
 */
export async function runSentimentPipeline(limit = 50) {
  console.log("[Sentiment] Starting pipeline...");
  const articles = await Article.find({ analyzed: false }).sort({ fetchedAt: -1 }).limit(limit);
  if (articles.length === 0) { console.log("[Sentiment] Nothing to process."); return; }

  let processed = 0, failed = 0;
  for (const article of articles) {
    try {
      const text = article.description || article.title;
      if (!text?.trim()) { await Article.updateOne({ _id: article._id }, { analyzed: true }); continue; }
      const sentiment = await analyzeSentiment(text);
      await Article.updateOne({ _id: article._id }, { sentiment, analyzed: true });
      processed++;
      await new Promise(r => setTimeout(r, 200)); // avoid Groq rate limits
    } catch (err) {
      failed++;
      console.error(`[Sentiment] Failed "${article.title?.slice(0, 40)}":`, err.message);
    }
  }
  console.log(`[Sentiment] Done — processed: ${processed}, failed: ${failed}`);
}

/**
 * 通用文章 / 新聞爬蟲
 * @param {string} url
 */
export async function crawlArticle(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    timeout: 10000,
  });

  if (!res.ok) throw new Error("Failed to fetch URL");

  const html = await res.text();
  const $ = cheerio.load(html);

  $("script, style, nav, footer, header, aside").remove();

  let text = "";
  $("article p, main p, p").each((_, el) => {
    const content = $(el).text().trim();
    if (content.length > 30) text += content + " ";
  });

  text = text.replace(/\s+/g, " ").trim();
  if (!text) throw new Error("No content extracted");

  return text.slice(0, 8000);
}

// ─── Scheduled Auto-Crawl ─────────────────────────────────────────────────────

/**
 * Keywords to monitor — edit this list to track different topics.
 * Each entry: { keywords: string[], locale: string, label: string }
 */
const KEYWORD_WATCHLIST = [
  { keywords: ["台灣 科技"],    locale: "zh-TW", label: "TW Tech"  },
  { keywords: ["AI 人工智慧"],  locale: "zh-TW", label: "AI News"  },
  { keywords: ["台積電"],       locale: "zh-TW", label: "TSMC"     },
  { keywords: ["cryptocurrency"], locale: "en-US", label: "Crypto" },
];

/** Topic feeds to auto-pull every cycle */
const TOPIC_WATCHLIST = [
  { topic: "topStories", locale: "zh-TW" },
  { topic: "technology",  locale: "zh-TW" },
];

/**
 * Run one full crawl cycle: keywords + topics -> save to MongoDB.
 * Duplicates are silently skipped via the unique URL index.
 */
export async function runCrawlCycle() {
  console.log("[Scheduler] Starting crawl cycle:", new Date().toISOString());
  let saved = 0;
  let skipped = 0;

  // 1. Keyword crawls
  for (const entry of KEYWORD_WATCHLIST) {
    try {
      const articles = await searchGoogleNews(entry.keywords, { locale: entry.locale, limit: 15 });
      const docs = articles.map((a) => ({
        ...a,
        crawler: "googleNews",
        keywords: entry.keywords,
        locale: entry.locale,
      }));

      const result = await Article.insertMany(docs, { ordered: false }).catch((err) => {
        if (err.code !== 11000) console.error(`[Scheduler] Insert error (${entry.label}):`, err.message);
        return err;
      });

      const insertedCount = result?.insertedCount ?? result?.result?.nInserted ?? 0;
      saved   += insertedCount;
      skipped += docs.length - insertedCount;
      console.log(`[Scheduler] "${entry.label}": +${insertedCount} new, ${docs.length - insertedCount} duplicates`);
    } catch (err) {
      console.error(`[Scheduler] Failed keyword "${entry.label}":`, err.message);
    }
  }

  // 2. Topic crawls
  for (const entry of TOPIC_WATCHLIST) {
    try {
      const articles = await fetchNewsByTopic(entry.topic, { locale: entry.locale, limit: 20 });
      const docs = articles.map((a) => ({
        ...a,
        crawler: "googleNews",
        topic: entry.topic,
        locale: entry.locale,
      }));

      const result = await Article.insertMany(docs, { ordered: false }).catch((err) => {
        if (err.code !== 11000) console.error(`[Scheduler] Insert error (${entry.topic}):`, err.message);
        return err;
      });

      const insertedCount = result?.insertedCount ?? result?.result?.nInserted ?? 0;
      saved   += insertedCount;
      skipped += docs.length - insertedCount;
      console.log(`[Scheduler] Topic "${entry.topic}": +${insertedCount} new, ${docs.length - insertedCount} duplicates`);
    } catch (err) {
      console.error(`[Scheduler] Failed topic "${entry.topic}":`, err.message);
    }
  }

  console.log(`[Scheduler] Cycle complete — saved: ${saved}, skipped: ${skipped}`);

  // Auto-run sentiment on newly saved articles
  if (saved > 0) {
    runSentimentPipeline(saved + 10).catch((err) =>
      console.error("[Sentiment] Auto-run failed:", err.message)
    );
  }
}

/**
 * Generate a report for the last 7 days (or custom range) and save to MongoDB.
 * @param {"weekly"|"daily"|"manual"} type
 * @param {Date} [from]  defaults to 7 days ago
 * @param {Date} [to]    defaults to now
 */
export async function generateReport(type = "weekly", from, to) {
  const now = to || new Date();
  const start = from || new Date(now - 7 * 24 * 60 * 60 * 1000);

  const articles = await Article.find({
    analyzed: true,
    fetchedAt: { $gte: start, $lte: now },
  }).select("title url source sentiment").lean();

  if (articles.length === 0) {
    console.log("[Report] No analyzed articles in range — skipping.");
    return null;
  }

  const stats = { total: articles.length, positive: 0, negative: 0, neutral: 0 };
  for (const a of articles) {
    const label = a.sentiment?.label?.toUpperCase();
    if (label === "POSITIVE") stats.positive++;
    else if (label === "NEGATIVE") stats.negative++;
    else stats.neutral++;
  }

  const topArticles = articles.slice(0, 5).map((a) => ({
    title: a.title, url: a.url, source: a.source, sentiment: a.sentiment?.label,
  }));

  const summary = `Total: ${stats.total}, Positive: ${stats.positive}, Negative: ${stats.negative}, Neutral: ${stats.neutral}. Top article: "${topArticles[0]?.title}"`;

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 300,
    messages: [
      { role: "system", content: "Write a concise 3-sentence analyst narrative summarizing this sentiment report data. Be factual and professional." },
      { role: "user", content: summary },
    ],
  });
  const narrative = completion.choices[0].message.content.trim();

  const report = await Report.create({ type, period: { from: start, to: now }, narrative, stats, topArticles });
  console.log(`[Report] ${type} report saved — ${stats.total} articles, id: ${report._id}`);
  return report;
}

/**
 * Start the cron scheduler. Call once from server.js after DB connects.
 * Default: every 2 hours. Override with NEWS_CRON_SCHEDULE env var.
 */
export function startNewsScheduler() {
  const schedule = process.env.NEWS_CRON_SCHEDULE || "0 */2 * * *";

  if (!cron.validate(schedule)) {
    console.error(`[Scheduler] Invalid cron expression: "${schedule}" — not started`);
    return;
  }

  console.log(`[Scheduler] News crawler scheduled: "${schedule}"`);

  // Run once immediately on startup
  runCrawlCycle().catch((err) => console.error("[Scheduler] Initial run failed:", err.message));

  // Then on schedule
  cron.schedule(schedule, () => {
    runCrawlCycle().catch((err) => console.error("[Scheduler] Scheduled run failed:", err.message));
  });

  // Weekly report — every Monday at 8am
  cron.schedule("0 8 * * 1", () => {
    generateReport("weekly").catch((err) => console.error("[Report] Weekly failed:", err.message));
  });
}