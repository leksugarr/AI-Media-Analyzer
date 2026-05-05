import fetch from "node-fetch";
import * as cheerio from "cheerio";
import cron from "node-cron";
import Groq from "groq-sdk";
import { searchGoogleNews, fetchNewsByTopic } from "./crawlers/googleNews.js";
import { Article, Report, KeywordSuggestion, WatchlistKeyword } from "./db.js";
import { runEmbeddingPipeline } from "./embedder.js";

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
 * Run Groq-based credibility / fake-news scoring on articles that haven't been checked yet.
 * Labels: credible | suspicious | likely_fake
 * Score: 0–1 (higher = more suspicious/fake)
 */
export async function runCredibilityPipeline(limit = 50) {
  console.log("[Credibility] Starting pipeline...");
  const articles = await Article.find({
    analyzed: true,
    $or: [
      { "credibility.label": { $exists: false } },
      { "credibility.label": null },
    ],
  })
    .sort({ fetchedAt: -1 })
    .limit(limit);

  if (articles.length === 0) { console.log("[Credibility] Nothing to process."); return; }

  let processed = 0, failed = 0;
  for (const article of articles) {
    try {
      const text = [article.title, article.description].filter(Boolean).join(" — ").slice(0, 400);
      if (!text.trim()) {
        await Article.updateOne({ _id: article._id }, { credibility: { label: "credible", score: 0, reason: "no text to evaluate", analyzedAt: new Date() } });
        continue;
      }

      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        max_tokens: 80,
        messages: [
          {
            role: "system",
            content: `You are a fact-checking assistant. Assess the credibility of this news snippet.
Reply ONLY with JSON (no markdown):
{"label":"credible"|"suspicious"|"likely_fake","score":0.0,"reason":"one short sentence"}
score: 0.0 = fully credible, 1.0 = clearly fake. Be strict but fair.`,
          },
          { role: "user", content: text },
        ],
      });

      const raw = completion.choices[0].message.content.trim();
      let result;
      try {
        result = JSON.parse(raw);
      } catch {
        const match = raw.match(/\{[^}]+\}/);
        if (match) result = JSON.parse(match[0]);
        else throw new Error(`Unparseable credibility response: ${raw}`);
      }

      await Article.updateOne({ _id: article._id }, {
        credibility: {
          label:      result.label  || "credible",
          score:      typeof result.score === "number" ? result.score : 0,
          reason:     result.reason || "",
          analyzedAt: new Date(),
        },
      });
      processed++;
      await new Promise(r => setTimeout(r, 250)); // avoid Groq rate limits
    } catch (err) {
      failed++;
      console.error(`[Credibility] Failed "${article.title?.slice(0, 40)}":`, err.message);
    }
  }
  console.log(`[Credibility] Done — processed: ${processed}, failed: ${failed}`);
}

// ─── TOPIC MODELING ────────────────────────────────────────────────────────────

/**
 * Canonical topic labels Groq must choose from.
 * Keeping this fixed list ensures consistent grouping across runs.
 */
const TOPIC_LABELS = [
  "科技產業",   // Tech & Industry
  "政治選舉",   // Politics & Elections
  "經濟金融",   // Economy & Finance
  "國際關係",   // International Relations
  "社會民生",   // Society & Livelihood
  "環境氣候",   // Environment & Climate
  "健康醫療",   // Health & Medicine
  "娛樂文化",   // Entertainment & Culture
  "軍事安全",   // Military & Security
  "教育學術",   // Education & Academia
];

/**
 * Assign topic clusters to articles that haven't been clustered yet.
 * Sends batches of 10 article titles to Groq and gets back a topic label per article.
 * Only runs on articles that are already analyzed (sentiment done).
 */
export async function runTopicPipeline(limit = 50) {
  console.log("[Topic] Starting topic modeling pipeline...");
  const articles = await Article.find({
    analyzed: true,
    $or: [
      { "topicCluster.label": { $exists: false } },
      { "topicCluster.label": null },
    ],
  })
    .sort({ fetchedAt: -1 })
    .limit(limit)
    .select("_id title description keywords");

  if (articles.length === 0) { console.log("[Topic] Nothing to cluster."); return; }

  // Process in batches of 10 to stay within token limits
  const BATCH = 10;
  let processed = 0, failed = 0;

  for (let i = 0; i < articles.length; i += BATCH) {
    const batch = articles.slice(i, i + BATCH);
    try {
      const articleList = batch
        .map((a, idx) => `${idx + 1}. ${a.title}${a.description ? " — " + a.description.slice(0, 100) : ""}`)
        .join("\n");

      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        max_tokens: 300,
        messages: [
          {
            role: "system",
            content: `You are a news topic classifier. Assign each article to exactly ONE topic from this list:
${TOPIC_LABELS.join(", ")}

Reply ONLY with a JSON array of objects, no markdown, one entry per article in the same order:
[{"index":1,"label":"科技產業","confidence":0.92}, ...]

confidence: 0.0–1.0. Use the label exactly as written above.`,
          },
          {
            role: "user",
            content: `Classify these ${batch.length} articles:\n${articleList}`,
          },
        ],
      });

      const raw = completion.choices[0].message.content.trim();
      let results;
      try {
        const clean = raw.replace(/```json|```/g, "").trim();
        results = JSON.parse(clean);
      } catch {
        const match = raw.match(/\[[\s\S]+\]/);
        if (!match) throw new Error(`Unparseable topic response: ${raw.slice(0, 100)}`);
        results = JSON.parse(match[0]);
      }

      // Write each result back to DB
      const now = new Date();
      for (const r of results) {
        const idx = (r.index ?? 0) - 1;
        if (idx < 0 || idx >= batch.length) continue;
        const article = batch[idx];
        const label = TOPIC_LABELS.includes(r.label) ? r.label : null;
        if (!label) continue;
        await Article.updateOne({ _id: article._id }, {
          topicCluster: {
            label,
            confidence: typeof r.confidence === "number" ? Math.round(r.confidence * 100) / 100 : null,
            assignedAt: now,
          },
        });
        processed++;
      }

      await new Promise(r => setTimeout(r, 500)); // avoid rate limits between batches
    } catch (err) {
      failed += batch.length;
      console.error(`[Topic] Batch ${Math.floor(i / BATCH) + 1} failed:`, err.message);
    }
  }
  console.log(`[Topic] Done — processed: ${processed}, failed: ${failed}`);
}

// ─── STANCE ANALYSIS ───────────────────────────────────────────────────────────

export async function runStancePipeline(limit = 50) {
  console.log("[Stance] Starting pipeline...");
  const articles = await Article.find({
    analyzed: true,
    $or: [
      { "stance.label": { $exists: false } },
      { "stance.label": null },
    ],
  })
    .sort({ fetchedAt: -1 })
    .limit(limit)
    .select("_id title description");

  if (articles.length === 0) { console.log("[Stance] Nothing to process."); return; }

  let processed = 0, failed = 0;
  for (const article of articles) {
    try {
      const text = [article.title, article.description].filter(Boolean).join(" — ").slice(0, 300);
      if (!text.trim()) {
        await Article.updateOne({ _id: article._id }, { stance: { label: "中立", reason: "no text", analyzedAt: new Date() } });
        continue;
      }

      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        max_tokens: 60,
        messages: [
          {
            role: "system",
            content: `判斷這篇新聞對其主要議題的立場。
Reply ONLY with JSON (no markdown):
{"label":"支持"|"反對"|"中立","reason":"一句話說明"}
支持 = supportive/positive stance, 反對 = opposing/critical stance, 中立 = neutral/reporting only.`,
          },
          { role: "user", content: text },
        ],
      });

      const raw = completion.choices[0].message.content.trim();
      let result;
      try {
        result = JSON.parse(raw);
      } catch {
        const match = raw.match(/\{[^}]+\}/);
        if (match) result = JSON.parse(match[0]);
        else throw new Error(`Unparseable stance response: ${raw}`);
      }

      const validLabels = ["支持", "反對", "中立"];
      await Article.updateOne({ _id: article._id }, {
        stance: {
          label:      validLabels.includes(result.label) ? result.label : "中立",
          reason:     result.reason || "",
          analyzedAt: new Date(),
        },
      });
      processed++;
      await new Promise(r => setTimeout(r, 250));
    } catch (err) {
      failed++;
      console.error(`[Stance] Failed "${article.title?.slice(0, 40)}":`, err.message);
    }
  }
  console.log(`[Stance] Done — processed: ${processed}, failed: ${failed}`);
}
 
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

  // Load active keywords from DB, fall back to hardcoded list if DB is empty
  const dbKeywords = await WatchlistKeyword.find({ active: true }).lean();
  const dynamicKeywords = dbKeywords.length > 0
    ? dbKeywords.map(k => ({ keywords: [k.keyword], locale: k.locale || "zh-TW", label: k.label || k.keyword }))
    : KEYWORD_WATCHLIST;

  console.log(`[Scheduler] Using ${dynamicKeywords.length} keywords (${dbKeywords.length > 0 ? "from DB" : "hardcoded fallback"})`);

  // 1. Keyword crawls
  for (const entry of dynamicKeywords) {
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
    // After sentiment, embed the newly analyzed articles
    setTimeout(() => {
      runEmbeddingPipeline(saved + 10).catch(err =>
        console.error("[Embedder] Auto-run failed:", err.message)
      );
    }, 15000); // wait 15s for sentiment to finish first
    // After sentiment, suggest new trending keywords
    setTimeout(() => {
      suggestKeywords().catch(err => console.error("[KeywordAI] Post-cycle suggestion failed:", err.message));
    }, 30000); // wait 30s for sentiment to finish first
    // After embedding + suggestions, run credibility scoring
    setTimeout(() => {
      runCredibilityPipeline(saved + 10).catch(err =>
        console.error("[Credibility] Auto-run failed:", err.message)
      );
    }, 45000); // wait 45s — after sentiment + embedding
    // After credibility, assign topic clusters
    setTimeout(() => {
      runTopicPipeline(saved + 10).catch(err =>
        console.error("[Topic] Auto-run failed:", err.message)
      );
    }, 60000); // wait 60s — after all prior pipelines

    // After topic pipeline, run stance analysis
setTimeout(() => {
  runStancePipeline(saved + 10).catch(err =>
    console.error("[Stance] Auto-run failed:", err.message)
  );
}, 75000); // wait 75s — after all prior pipelines
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
 * Analyze recent articles and suggest trending keywords via Groq.
 * Skips keywords already in watchlist or already suggested (pending/approved).
 */
export async function suggestKeywords() {
  console.log("[KeywordAI] Analyzing articles for trending keywords...");
  try {
    // Grab the 30 most recent analyzed articles
    const articles = await Article.find({ analyzed: true })
      .sort({ fetchedAt: -1 })
      .limit(30)
      .select("title description keywords sentiment")
      .lean();

    if (articles.length === 0) {
      console.log("[KeywordAI] No articles to analyze.");
      return;
    }

    // Get already-known keywords to avoid duplicates
    const existingWatchlist = await WatchlistKeyword.find({}).select("keyword").lean();
    const existingSuggestions = await KeywordSuggestion.find({ status: { $in: ["pending", "approved"] } }).select("keyword").lean();
    const knownKeywords = new Set([
      ...existingWatchlist.map(k => k.keyword.toLowerCase()),
      ...existingSuggestions.map(k => k.keyword.toLowerCase()),
    ]);

    const articleSummary = articles
      .map(a => `- ${a.title} [${a.sentiment?.label || "?"}]`)
      .join("\n");

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 600,
      messages: [
        {
          role: "system",
          content: `You are a media analyst. Given a list of recent news article titles, identify 5 trending topics or keywords worth monitoring. 
For each, provide a short reason why it's trending.
Reply ONLY with a JSON array, no markdown:
[{"keyword":"...", "reason":"...", "locale":"zh-TW or en-US"}, ...]
Keep keywords concise (1-4 words). Mix Chinese and English based on the content language.`,
        },
        {
          role: "user",
          content: `Recent articles:\n${articleSummary}\n\nAlready monitored (skip these): ${[...knownKeywords].join(", ") || "none"}`,
        },
      ],
    });

    const raw = completion.choices[0].message.content.trim();
    let suggestions;
    try {
      const clean = raw.replace(/```json|```/g, "").trim();
      suggestions = JSON.parse(clean);
    } catch {
      const match = raw.match(/\[[\s\S]+\]/);
      if (!match) { console.error("[KeywordAI] Failed to parse Groq response"); return; }
      suggestions = JSON.parse(match[0]);
    }

    // Filter out any that match known keywords
    const newSuggestions = suggestions.filter(
      s => s.keyword && !knownKeywords.has(s.keyword.toLowerCase())
    );

    if (newSuggestions.length === 0) {
      console.log("[KeywordAI] No new keywords to suggest.");
      return;
    }

    // Save to DB
    const docs = newSuggestions.map(s => ({
      keyword: s.keyword,
      reason: s.reason || "",
      source: articles.slice(0, 3).map(a => a.title).join("; "),
    }));

    await KeywordSuggestion.insertMany(docs, { ordered: false }).catch(() => {});
    console.log(`[KeywordAI] Suggested ${docs.length} new keywords: ${docs.map(d => d.keyword).join(", ")}`);
  } catch (err) {
    console.error("[KeywordAI] suggestKeywords failed:", err.message);
  }
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