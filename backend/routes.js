import { crawlArticle, generateReport, suggestKeywords, runCredibilityPipeline, runTopicPipeline, runStancePipeline, groqWithRetry } from "./crawler.js";
import express from "express";
import Groq from "groq-sdk";
import { tavily } from "@tavily/core";import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import * as lineSdk from "@line/bot-sdk";


import { validateText, sanitizeKeyword } from "./middleware.js";
import { embedQuery, cosineSimilarity, runEmbeddingPipeline } from "./embedder.js";
import { crawlPTTBoard, crawlPTTArticle } from "./crawlers/ptt.js";          // ← fixed path
import { Analysis, User, Conversation, Article, Report, KeywordSuggestion, WatchlistKeyword } from "./db.js";
import {
  searchGoogleNews,
  fetchNewsByTopic,
  resolveGoogleNewsUrl,
  VALID_TOPICS,
  VALID_LOCALES,
} from "./crawlers/googleNews.js";


const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
  
  /* ================================================
   STANCE ANALYSIS
   ================================================ */

router.get("/stance/status", async (req, res) => {
  try {
    const [total, unscored] = await Promise.all([
      Article.countDocuments({ analyzed: true }),
      Article.countDocuments({ analyzed: true, $or: [{ "stance.label": { $exists: false } }, { "stance.label": null }] }),
    ]);

    const distribution = await Article.aggregate([
      { $match: { analyzed: true, "stance.label": { $ne: null } } },
      { $group: { _id: "$stance.label", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.json({
      total,
      scored: total - unscored,
      unscored,
      distribution: distribution.map(d => ({ label: d._id, count: d.count })),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stance status" });
  }
});

router.post("/stance/run", async (req, res) => {
  const limit = Math.min(Number(req.body?.limit) || 50, 200);
  try {
    runStancePipeline(limit).catch(err =>
      console.error("[Stance] Manual run failed:", err.message)
    );
    res.json({ message: `Stance pipeline started for up to ${limit} articles` });
  } catch (err) {
    res.status(500).json({ error: "Failed to start stance pipeline" });
  }
});

router.get("/stance/by-keyword", sanitizeKeyword, async (req, res) => {
  const { keyword } = req.query;
  if (!keyword) return res.status(400).json({ error: "keyword required" });
  try {
    const distribution = await Article.aggregate([
      { $match: { analyzed: true, "stance.label": { $ne: null }, keywords: keyword } },
      { $group: { _id: "$stance.label", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const total = distribution.reduce((s, d) => s + d.count, 0);
    res.json({
      keyword,
      total,
      distribution: distribution.map(d => ({ label: d._id, count: d.count })),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stance by keyword" });
  }
});


/* ─── Auth Helper ──────────────────────────────────────────────────────────── */
function getUserFromToken(req) {
  try {
    const auth = req.headers.authorization;
    console.log("🔑 Auth header:", auth);
    if (!auth?.startsWith("Bearer ")) return null;
    const token = auth.split(" ")[1];
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    console.log("🔑 Token error:", err.message);
    return null;
  }
}

/* ─── AI Init ──────────────────────────────────────────────────────────────── */
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY });
async function analyzeSentiment(text) {
  const input = text.slice(0, 200);
const completion = await groqWithRetry(() => groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
    max_tokens: 1000,
    messages: [
      {
        role: "system",
        content: `Classify sentiment. Reply ONLY with JSON: {"label":"POSITIVE"|"NEGATIVE"|"NEUTRAL","score":0.0}`,
      },
      { role: "user", content: input },
    ],
  }));
  const raw = completion.choices[0].message.content.trim();
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[^}]+\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error(`Unparseable sentiment response: ${raw}`);
  }
}
/* ================================================
   AUTH ROUTES
   ================================================ */

router.post("/auth/signup", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ success: false, message: "Email and password required" });
  if (password.length < 6)
    return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });

  try {
    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ success: false, message: "Email already registered" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ email, password: hashed });
    const token = jwt.sign({ userId: user._id, email }, JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({ success: true, message: "Account created!", user: { email }, token });
  } catch (err) {
    console.error("Signup error:", err.message);
    res.status(500).json({ success: false, message: "Signup failed" });
  }
});

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ success: false, message: "Email and password required" });

  try {
    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({ success: false, message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ success: false, message: "Invalid credentials" });

    const token = jwt.sign({ userId: user._id, email }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ success: true, message: "Login successful", user: { email }, token });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ success: false, message: "Login failed" });
  }
});

/* ================================================
   ANALYZE
   ================================================ */
router.post("/analyze", validateText, async (req, res) => {
  const { text } = req.body;

  try {
    const completion = await groqWithRetry(() => groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content: `You are an article analyzer. Given an article in any language, respond ONLY with a valid JSON object, no markdown:
    {
      "summary": "2-3 sentence summary in the same language as the article",
      "sentiment": {
        "label": "POSITIVE or NEGATIVE or NEUTRAL",
        "score": 0.0
      },
      "keywords": ["keyword1", "keyword2", "keyword3"]
    }`,
            },
            { role: "user", content: text },
          ],
        }));
    const raw = completion.choices[0].message.content.replace(/```json|```/g, "").trim();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { reply: raw };
    }

    const userInfo = getUserFromToken(req);
    await Analysis.create({
      originalText: text,
      summary: data.summary,
      sentiment: data.sentiment,
      userId: userInfo?.userId || "anonymous",
    }).catch((err) => console.error("MongoDB save error:", err.message));

    res.json({ summary: data.summary, sentiment: data.sentiment, keywords: data.keywords });
  } catch (err) {
    console.error("Analyze error:", err.message);
    res.status(500).json({ error: "Analysis failed" });
  }
});

/* ================================================
   CONVERSATION ROUTES
   ================================================ */
router.post("/conversation", async (req, res) => {
  const { messages, conversationId } = req.body;
  if (!messages || !messages.length)
    return res.status(400).json({ error: "Messages required" });

  const userInfo = getUserFromToken(req);
  if (!userInfo) return res.status(401).json({ error: "Unauthorized" });

  try {
    const lastUserMsg = messages.filter((m) => m.role === "user").at(-1)?.content;

    let searchContext = "";
    try {
      const searchResult = await tavilyClient.search(
        typeof lastUserMsg === "string" ? lastUserMsg : JSON.stringify(lastUserMsg),
        { maxResults: 3, searchDepth: "basic" }
      );
      searchContext = searchResult.results
        .map((r) => `${r.title}: ${r.content}`)
        .join("\n\n");
    } catch (err) {
      console.error("Tavily search error:", err.message);
    }

    const systemPrompt = {
      role: "system",
      content: `You are a real-world topic analyzer chatbot with access to current web information.
${searchContext ? `\nCurrent information from the web:\n${searchContext}\n` : ""}

RULES:
1. If the user's message is a greeting, casual chat, or vague opener (e.g. "hi", "hello", "I want to ask something") → respond ONLY with: { "reply": "your friendly response" }

2. If this is the FIRST real topic question (asking about a specific real-world issue, event, or phenomenon) → respond with the FULL analysis JSON:
{
  "reply": "2-3 sentence conversational summary of the topic based on current info",
  "category": "one of: Environment / Economy / Technology / Health / Politics / Society / Science",
  "subtopics": ["subtopic1", "subtopic2", "subtopic3"],
  "sentiment": { "label": "POSITIVE or NEGATIVE or NEUTRAL", "score": 0.0 },
  "heatmap": {
    "years": [2020, 2021, 2022, 2023, 2024],
    "months": ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    "data": [
      [10,20,30,40,50,60,70,80,90,100,90,80],
      [20,30,40,50,60,70,80,90,100,90,80,70],
      [30,40,50,60,70,80,90,100,90,80,70,60],
      [40,50,60,70,80,90,100,90,80,70,60,50],
      [50,60,70,80,90,100,90,80,70,60,50,40]
    ]
  }
}
heatmap.data is a 2D array [year][month] where each value is discussion intensity 0-100. Make it realistic for the topic.

3. If the user is asking a follow-up, challenging a previous answer, or asking for more detail → respond ONLY with: { "reply": "your detailed answer based on real data and current info" }

Always respond in the same language the user uses. Always valid JSON, no markdown fences.`,
    };

    const payload = messages.map((m) => ({
      role: m.role,
      content:
        typeof m.content === "string"
          ? m.content
          : m.content?.reply || JSON.stringify(m.content),
    }));

      const completion = await groqWithRetry(() => groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [systemPrompt, ...payload],
          }));
    const raw = completion.choices[0].message.content.replace(/```json|```/g, "").trim();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { reply: raw };
    }

    const updatedMessages = [...messages, { role: "assistant", content: data }];

    let conversation;
    if (conversationId) {
      conversation = await Conversation.findOneAndUpdate(
        { _id: conversationId, userId: userInfo.userId },
        { messages: updatedMessages, updatedAt: new Date() },
        { new: true }
      );
    } else {
      const firstUserMsg = messages.find((m) => m.role === "user")?.content || "New conversation";
      const title =
        typeof firstUserMsg === "string"
          ? firstUserMsg.slice(0, 60)
          : firstUserMsg?.reply?.slice(0, 60) || "New conversation";

      conversation = await Conversation.create({
        userId: userInfo.userId,
        title,
        messages: updatedMessages,
      });
    }

    res.json({ data, conversationId: conversation._id });
  } catch (err) {
    console.error("Conversation error:", err.message);
    res.status(500).json({ error: "Conversation failed" });
  }
});

// GET all conversations (for history sidebar)
router.get("/conversations", async (req, res) => {
  const userInfo = getUserFromToken(req);
  if (!userInfo) return res.status(401).json({ error: "Unauthorized" });

  try {
    const conversations = await Conversation.find({ userId: userInfo.userId })
      .sort({ updatedAt: -1 })
      .limit(20)
      .select("title createdAt updatedAt");

    res.json({ conversations });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

// GET single conversation by id
router.get("/conversation/:id", async (req, res) => {
  const userInfo = getUserFromToken(req);
  if (!userInfo) return res.status(401).json({ error: "Unauthorized" });

  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      userId: userInfo.userId,
    });

    if (!conversation) return res.status(404).json({ error: "Conversation not found" });

    res.json({ conversation });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch conversation" });
  }
});

/* ================================================
   CRAWL
   ================================================ */
router.post("/crawl", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL required" });

  try {
    const text = await crawlArticle(url);
    req.body.text = text;
    return router.handle(req, res);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Crawl failed" });
  }
});

router.post("/crawl/ptt", async (req, res) => {
  const { board = "Gossiping", limit = 3 } = req.body;

  try {
    const articles = await crawlPTTBoard(board, limit);
    let combinedText = "";
    for (const a of articles) {
      const article = await crawlPTTArticle(a.url);
      combinedText += `標題：${a.title}\n${article.content}\n${article.pushes}\n\n`;
    }
    req.body.text = combinedText;
    return router.handle(req, res);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "PTT crawl failed" });
  }
});

/* ================================================
   HISTORY
   ================================================ */
router.get("/history", async (req, res) => {
  try {
    const userInfo = getUserFromToken(req);
    if (!userInfo) return res.status(401).json({ error: "Unauthorized" });

    const analyses = await Analysis.find({ userId: userInfo.userId })
      .sort({ timestamp: -1 })
      .limit(20)
      .select("originalText summary sentiment timestamp");

    res.json({ analyses });
  } catch (err) {
    console.error("History fetch error:", err.message);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

/* ================================================
   GOOGLE NEWS ROUTES
   ================================================ */

/**
 * POST /api/news/search
 * Body: { keywords: string|string[], locale?: string, limit?: number, save?: boolean }
 */
router.post("/news/search", sanitizeKeyword, async (req, res) => {
    const { keywords, locale = "zh-TW", limit = 20, save = false } = req.body;

  if (!keywords || (Array.isArray(keywords) && keywords.length === 0))
    return res.status(400).json({ error: "keywords is required" });

  if (!VALID_LOCALES.includes(locale))
    return res.status(400).json({ error: `Invalid locale. Valid: ${VALID_LOCALES.join(", ")}` });

  const clampedLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);

  try {
    const articles = await searchGoogleNews(keywords, { locale, limit: clampedLimit });

    if (save && articles.length > 0) {
      const keywordsArray = Array.isArray(keywords) ? keywords : [keywords];
      const docs = articles.map((a) => ({ ...a, crawler: "googleNews", keywords: keywordsArray, locale }));
      await Article.insertMany(docs, { ordered: false }).catch((err) => {
        if (err.code !== 11000) console.error("Article save error:", err.message);
      });
    }

    res.json({ articles, total: articles.length });
  } catch (err) {
    console.error("News search error:", err.message);
    res.status(500).json({ error: "Failed to fetch news", detail: err.message });
  }
});

/**
 * POST /api/news/topic
 * Body: { topic?: string, locale?: string, limit?: number, save?: boolean }
 */
router.post("/news/topic", async (req, res) => {
  const { topic = "topStories", locale = "zh-TW", limit = 20, save = false } = req.body;

  if (!VALID_TOPICS.includes(topic))
    return res.status(400).json({ error: `Invalid topic. Valid: ${VALID_TOPICS.join(", ")}` });

  if (!VALID_LOCALES.includes(locale))
    return res.status(400).json({ error: `Invalid locale. Valid: ${VALID_LOCALES.join(", ")}` });

  const clampedLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);

  try {
    const articles = await fetchNewsByTopic(topic, { locale, limit: clampedLimit });

    if (save && articles.length > 0) {
      const docs = articles.map((a) => ({ ...a, crawler: "googleNews", topic, locale }));
      await Article.insertMany(docs, { ordered: false }).catch((err) => {
        if (err.code !== 11000) console.error("Article save error:", err.message);
      });
    }

    res.json({ articles, topic, total: articles.length });
  } catch (err) {
    console.error("News topic error:", err.message);
    res.status(500).json({ error: "Failed to fetch topic news", detail: err.message });
  }
});

/**
 * GET /api/news/latest
 * Query: keyword?, crawler?, analyzed?, limit?, page?
 */
router.get("/news/latest", sanitizeKeyword, async (req, res) => {
    const { keyword, crawler, analyzed, sentiment, credibility, limit = 20, page = 1 } = req.query;

  const clampedLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * clampedLimit;

  const filter = {};
  if (keyword)              filter.title              = { $regex: keyword, $options: "i" };
  if (crawler)              filter.crawler            = crawler;
  if (analyzed === "true")  filter.analyzed           = true;
  if (analyzed === "false") filter.analyzed           = false;
  if (sentiment)            filter["sentiment.label"] = sentiment.toUpperCase();
  if (credibility)          filter["credibility.label"] = credibility;

  try {
    const [articles, total] = await Promise.all([
      Article.find(filter).sort({ fetchedAt: -1 }).skip(skip).limit(clampedLimit).select("-crawlerMeta -__v"),
      Article.countDocuments(filter),
    ]);

    res.json({ articles, total, page: Number(page), pages: Math.ceil(total / clampedLimit) });
  } catch (err) {
    console.error("News latest error:", err.message);
    res.status(500).json({ error: "Failed to fetch saved articles" });
  }
});

/**
 * POST /api/news/resolve
 * Body: { url: string }
 */
router.post("/news/resolve", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "url is required" });

  try {
    const resolvedUrl = await resolveGoogleNewsUrl(url);
    res.json({ originalUrl: url, resolvedUrl });
  } catch (err) {
    console.error("URL resolve error:", err.message);
    res.status(500).json({ error: "Failed to resolve URL" });
  }
});

/* ================================================
   SENTIMENT PIPELINE
   ================================================ */

/**
 * POST /api/analyze/batch
 * Processes all unanalyzed articles in MongoDB using HuggingFace.
 * Body: { limit?: number }  — how many to process per call (default 20)
 */
router.post("/analyze/batch", async (req, res) => {
  const limit = Math.min(Number(req.body?.limit) || 20, 100);

  try {
    const articles = await Article.find({ analyzed: false })
      .sort({ fetchedAt: -1 })
      .limit(limit);

    if (articles.length === 0)
      return res.json({ message: "No unanalyzed articles found", processed: 0 });

    let processed = 0;
    let failed = 0;

    for (const article of articles) {
      try {
        const text = article.description || article.title;
        if (!text?.trim()) {
          await Article.updateOne({ _id: article._id }, { analyzed: true });
          continue;
        }

        const sentiment = await analyzeSentiment(text);

        await Article.updateOne(
          { _id: article._id },
          { sentiment, analyzed: true }
        );
        processed++;
        console.log(`[Sentiment] ✅ "${article.title.slice(0, 50)}" → ${sentiment.label} (${sentiment.score})`);
      } catch (err) {
        failed++;
        console.error(`[Sentiment] ❌ Failed "${article.title?.slice(0, 50)}":`, err.message);
      }
    }

    res.json({
      message: `Processed ${processed} articles, ${failed} failed`,
      processed,
      failed,
      remaining: await Article.countDocuments({ analyzed: false }),
    });
  } catch (err) {
    console.error("Batch analyze error:", err.message);
    res.status(500).json({ error: "Batch analysis failed" });
  }
});

/**
 * GET /api/analyze/status
 * Returns count of analyzed vs unanalyzed articles.
 */
router.get("/analyze/status", async (req, res) => {
  try {
    const [total, analyzed, unanalyzed] = await Promise.all([
      Article.countDocuments(),
      Article.countDocuments({ analyzed: true }),
      Article.countDocuments({ analyzed: false }),
    ]);
    res.json({ total, analyzed, unanalyzed });
  } catch (err) {
    res.status(500).json({ error: "Failed to get status" });
  }
});

/* ================================================
   REPORTS
   ================================================ */

/** GET /api/reports — list saved reports, newest first */
router.get("/reports", async (req, res) => {
  try {
    const reports = await Report.find().sort({ createdAt: -1 }).limit(20);
    res.json({ reports });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

/** POST /api/reports/generate — manually trigger a report */
router.post("/reports/generate", async (req, res) => {
  try {
    const report = await generateReport("manual");
    if (!report) return res.json({ message: "No analyzed articles found — report not created" });
    res.json({ message: "Report generated", report });
  } catch (err) {
    console.error("Report generation error:", err.message);
    res.status(500).json({ error: "Report generation failed" });
  }
});

/* ================================================
   KEYWORD WATCHLIST & SUGGESTIONS
   ================================================ */

/** GET /api/watchlist — list all active watchlist keywords */
router.get("/watchlist", async (req, res) => {
  try {
    const keywords = await WatchlistKeyword.find({}).sort({ addedAt: -1 });
    res.json({ keywords });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch watchlist" });
  }
});

/** POST /api/watchlist — manually add a keyword */
router.post("/watchlist", sanitizeKeyword, async (req, res) => {
    const { keyword, locale = "zh-TW", label } = req.body;
  if (!keyword?.trim()) return res.status(400).json({ error: "keyword is required" });
  try {
    const entry = await WatchlistKeyword.create({
      keyword: keyword.trim(),
      locale,
      label: label || keyword.trim(),
    });
    res.json({ message: "Keyword added", entry });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "Keyword already exists" });
    res.status(500).json({ error: "Failed to add keyword" });
  }
});

/** DELETE /api/watchlist/:id — remove a keyword */
router.delete("/watchlist/:id", async (req, res) => {
  try {
    await WatchlistKeyword.findByIdAndDelete(req.params.id);
    res.json({ message: "Keyword removed" });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove keyword" });
  }
});

/** PATCH /api/watchlist/:id/toggle — enable/disable a keyword */
router.patch("/watchlist/:id/toggle", async (req, res) => {
  try {
    const kw = await WatchlistKeyword.findById(req.params.id);
    if (!kw) return res.status(404).json({ error: "Not found" });
    kw.active = !kw.active;
    await kw.save();
    res.json({ message: `Keyword ${kw.active ? "enabled" : "disabled"}`, active: kw.active });
  } catch (err) {
    res.status(500).json({ error: "Failed to toggle keyword" });
  }
});

/** GET /api/suggestions — list pending keyword suggestions */
router.get("/suggestions", async (req, res) => {
  try {
    const { status = "pending" } = req.query;
    const suggestions = await KeywordSuggestion.find({ status }).sort({ suggestedAt: -1 }).limit(50);
    res.json({ suggestions });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch suggestions" });
  }
});

/** POST /api/suggestions/approve/:id — approve a suggestion → adds to watchlist */
router.post("/suggestions/approve/:id", async (req, res) => {
  try {
    const suggestion = await KeywordSuggestion.findById(req.params.id);
    if (!suggestion) return res.status(404).json({ error: "Suggestion not found" });

    // Add to watchlist
    await WatchlistKeyword.create({
      keyword: suggestion.keyword,
      locale: "zh-TW",
      label: suggestion.keyword,
    }).catch(err => {
      if (err.code !== 11000) throw err; // ignore duplicate
    });

    suggestion.status = "approved";
    suggestion.decidedAt = new Date();
    await suggestion.save();

    res.json({ message: `"${suggestion.keyword}" approved and added to watchlist` });
  } catch (err) {
    res.status(500).json({ error: "Failed to approve suggestion" });
  }
});

/** POST /api/suggestions/reject/:id — reject a suggestion */
router.post("/suggestions/reject/:id", async (req, res) => {
  try {
    const suggestion = await KeywordSuggestion.findByIdAndUpdate(
      req.params.id,
      { status: "rejected", decidedAt: new Date() },
      { new: true }
    );
    if (!suggestion) return res.status(404).json({ error: "Suggestion not found" });
    res.json({ message: `"${suggestion.keyword}" rejected` });
  } catch (err) {
    res.status(500).json({ error: "Failed to reject suggestion" });
  }
});

/** POST /api/suggestions/run — manually trigger keyword suggestion */
router.post("/suggestions/run", async (req, res) => {
  try {
    await suggestKeywords();
    res.json({ message: "Keyword suggestion run complete" });
  } catch (err) {
    res.status(500).json({ error: "Failed to run keyword suggestion" });
  }
});

/** GET /api/heatmap
 *  Returns sentiment intensity per watchlist keyword per week.
 *  Response shape:
 *  {
 *    weeks: ["2025-W01", "2025-W02", ...],   // X axis — last 12 weeks
 *    keywords: ["台積電", "AI", ...],          // Y axis — active watchlist keywords
 *    cells: { "台積電::2025-W01": { avg: 0.72, label: "POSITIVE", count: 4 }, ... }
 *  }
 */
router.get("/heatmap", async (req, res) => {
  try {
    // ── 1. Get active watchlist keywords ──────────────────────────────────────
    const watchlist = await WatchlistKeyword.find({ active: true }).lean();
    if (!watchlist.length) return res.json({ weeks: [], keywords: [], cells: {} });

    const keywords = watchlist.map((w) => w.keyword);

    // ── 2. Build 12-week window ───────────────────────────────────────────────
    const now = new Date();
    const weeksBack = 12;
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const windowStart = new Date(now - weeksBack * msPerWeek);

    // ── 3. Aggregate articles by keyword + ISO week ───────────────────────────
    const pipeline = [
      {
        $match: {
          analyzed: true,
          "sentiment.score": { $ne: null },
          publishedAt: { $gte: windowStart },
          keywords: { $in: keywords },
        },
      },
      { $unwind: "$keywords" },
      { $match: { keywords: { $in: keywords } } },
      {
        $group: {
          _id: {
            keyword: "$keywords",
            year:    { $isoWeekYear: "$publishedAt" },
            week:    { $isoWeek: "$publishedAt" },
          },
          avgScore:     { $avg: "$sentiment.score" },
          count:        { $sum: 1 },
          // majority label
          posCount:     { $sum: { $cond: [{ $eq: ["$sentiment.label", "POSITIVE"] }, 1, 0] } },
          negCount:     { $sum: { $cond: [{ $eq: ["$sentiment.label", "NEGATIVE"] }, 1, 0] } },
        },
      },
    ];

    const rows = await Article.aggregate(pipeline);

    // ── 4. Build week labels for last 12 weeks ────────────────────────────────
    function isoWeekLabel(date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
      const week1 = new Date(d.getFullYear(), 0, 4);
      const weekNum = 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
      return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
    }

    const weeks = [];
    for (let i = weeksBack - 1; i >= 0; i--) {
      weeks.push(isoWeekLabel(new Date(now - i * msPerWeek)));
    }

    // ── 5. Build cells map ────────────────────────────────────────────────────
const cells = {};
    for (const row of rows) {
      const weekLabel = `${row._id.year}-W${String(row._id.week).padStart(2, "0")}`;
      if (!weeks.includes(weekLabel)) continue;
      const key = `${row._id.keyword}::${weekLabel}`;
      const total = row.count;
      const intensity = Math.round(((row.posCount - row.negCount) / total) * 100) / 100;
      const label = intensity > 0.1 ? "POSITIVE" : intensity < -0.1 ? "NEGATIVE" : "NEUTRAL";
      cells[key] = { intensity, label, count: total };
    }
    res.json({ weeks, keywords, cells });
  } catch (err) {
    console.error("Heatmap error:", err.message);
    res.status(500).json({ error: "Failed to build heatmap" });
  }
});

/* ================================================
   SEMANTIC SEARCH & EMBEDDINGS
   ================================================ */

/** POST /api/semantic-search
 *  Body: { query: string, limit?: number }
 *  Embeds the query then scores all embedded articles by cosine similarity.
 */
router.post("/semantic-search", sanitizeKeyword, async (req, res) => {
    const { query, limit = 10 } = req.body;
  if (!query?.trim()) return res.status(400).json({ error: "query is required" });

  try {
    const queryVec = await embedQuery(query);

    const articles = await Article.find({
      embedding: { $exists: true, $not: { $size: 0 } },
    })
      .select("title url source description sentiment publishedAt keywords crawler embedding")
      .lean();

    if (articles.length === 0) {
      return res.json({ articles: [], message: "No embedded articles yet — run the embedding pipeline first" });
    }

    const scored = articles
      .map(a => ({ ...a, score: cosineSimilarity(queryVec, a.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ embedding, ...rest }) => rest);

    res.json({ articles: scored, total: scored.length });
  } catch (err) {
    console.error("[SemanticSearch] Error:", err.message);
    res.status(500).json({ error: "Semantic search failed" });
  }
});

/** GET /api/similar/:id
 *  Returns the 5 most semantically similar articles to the given article ID.
 */
router.get("/similar/:id", async (req, res) => {
  try {
    const source = await Article.findById(req.params.id).lean();
    if (!source) return res.status(404).json({ error: "Article not found" });
    if (!source.embedding?.length) {
      return res.json({ articles: [], message: "This article hasn't been embedded yet" });
    }

    const candidates = await Article.find({
      _id: { $ne: source._id },
      embedding: { $exists: true, $not: { $size: 0 } },
    })
      .select("title url source sentiment publishedAt keywords embedding")
      .lean();

    const similar = candidates
      .map(a => ({ ...a, score: cosineSimilarity(source.embedding, a.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ embedding, ...rest }) => rest);

    res.json({ articles: similar });
  } catch (err) {
    console.error("[Similar] Error:", err.message);
    res.status(500).json({ error: "Failed to find similar articles" });
  }
});

/** POST /api/embed/run
 *  Manually trigger embedding pipeline to backfill existing articles.
 *  Body: { limit?: number }
 */
router.post("/embed/run", async (req, res) => {
  const limit = Math.min(Number(req.body?.limit) || 30, 100);
  try {
    runEmbeddingPipeline(limit).catch(err =>
      console.error("[Embedder] Manual run failed:", err.message)
    );
    res.json({ message: `Embedding pipeline started for up to ${limit} articles` });
  } catch (err) {
    res.status(500).json({ error: "Failed to start embedding pipeline" });
  }
});

/* ================================================
   LINE BOT
   ================================================ */

const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || "your_channel_secret";
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || "your_channel_access_token";

const lineClient = new lineSdk.messagingApi.MessagingApiClient({ channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN });

// LINE signature verification uses crypto directly (see webhook handler)

// Helper: reply to LINE
async function lineReply(replyToken, text) {
  await lineClient.replyMessage({ replyToken, messages: [{ type: "text", text }] });
}

// Helper: format article list
function formatArticles(articles) {
  if (!articles.length) return "找不到相關文章。";
  return articles.map((a, i) => {
    const credLabel = a.credibility?.label;
    const credFlag =
      credLabel === "likely_fake"  ? " 🚨可疑假訊息" :
      credLabel === "suspicious"   ? " ⚠️ 可疑內容"  : "";
    return `${i + 1}. ${a.title}${credFlag}\n${a.sentiment?.label || "—"} | ${a.source || ""}\n${a.url}`;
  }).join("\n\n");
}

/**
 * POST /api/line/webhook
 * Handles incoming LINE messages.
 *
 * Commands:
 *   搜尋 <keyword>  → top 3 articles from DB matching keyword
 *   報告            → latest report narrative + stats
 *   狀態            → analyzed/unanalyzed article counts
 *   <anything else> → Groq AI reply
 */
router.post(
  "/line/webhook",
  (req, res, next) => {
    const body = JSON.stringify(req.body);
    const sig = req.headers["x-line-signature"];
    const hash = crypto.createHmac("sha256", LINE_CHANNEL_SECRET).update(body).digest("base64");
    if (sig !== hash) return res.status(403).json({ error: "Invalid signature" });
    next();
  },
  async (req, res) => {
    res.sendStatus(200); // respond immediately so LINE doesn't retry

    const events = req.body.events || [];
    for (const event of events) {
      if (event.type !== "message" || event.message.type !== "text") continue;

    const text = event.message.text.trim();
    const replyToken = event.replyToken;
    const senderId = event.source?.userId || event.source?.groupId || "unknown";
    console.log(`[LINE] Message from: ${senderId} | text: "${text}"`);

      try {
        // ── 搜尋 <keyword> ──────────────────────────────────────────────────
        if (text.startsWith("搜尋 ") || text.startsWith("搜索 ")) {
          const keyword = text.slice(3).trim();
          if (!keyword) { await lineReply(replyToken, "請輸入關鍵字，例如：搜尋 台積電"); continue; }

          const articles = await Article.find({
            $or: [
              { title: { $regex: keyword, $options: "i" } },
              { keywords: { $regex: keyword, $options: "i" } },
            ],
          }).sort({ fetchedAt: -1 }).limit(3).select("title url source sentiment credibility").lean();

          await lineReply(replyToken, `🔍 「${keyword}」搜尋結果：\n\n${formatArticles(articles)}`);

        // ── 報告 ────────────────────────────────────────────────────────────
        } else if (text === "報告" || text === "report") {
          const report = await Report.findOne().sort({ createdAt: -1 }).lean();
          if (!report) { await lineReply(replyToken, "尚無報告，請先在 Dashboard 產生報告。"); continue; }

          const { stats, narrative, period } = report;
          const from = period?.from ? new Date(period.from).toLocaleDateString("zh-TW") : "?";
          const to   = period?.to   ? new Date(period.to).toLocaleDateString("zh-TW")   : "?";
          const msg  = `📊 最新報告（${from} – ${to}）\n\n正面：${stats.positive} | 負面：${stats.negative} | 中立：${stats.neutral} | 共：${stats.total}\n\n${narrative}`;
          await lineReply(replyToken, msg);

        // ── 狀態 ────────────────────────────────────────────────────────────
        } else if (text === "狀態" || text === "status") {
          const [total, analyzed, unanalyzed] = await Promise.all([
            Article.countDocuments(),
            Article.countDocuments({ analyzed: true }),
            Article.countDocuments({ analyzed: false }),
          ]);
          await lineReply(replyToken, `📈 文章狀態\n\n總計：${total}\n已分析：${analyzed}\n待分析：${unanalyzed}`);

        // ── 幫助 ────────────────────────────────────────────────────────────
        } else if (text === "幫助" || text === "help" || text === "說明") {
          await lineReply(replyToken,
            "🤖 輿情分析機器人指令：\n\n" +
            "搜尋 <關鍵字> — 查詢最新文章\n" +
            "報告 — 查看最新週報\n" +
            "狀態 — 查看文章統計\n" +
            "幫助 — 顯示此說明\n\n" +
            "或直接輸入任何問題，AI 將為您回答。"
          );

        // ── Groq fallback ───────────────────────────────────────────────────
        } else {
      const completion = await groqWithRetry(() => groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            max_tokens: 200,
            messages: [
              { role: "system", content: "你是一個輿情分析助手。用繁體中文簡短回答，最多150字。" },
              { role: "user", content: text },
            ],
          }));
                    await lineReply(replyToken, completion.choices[0].message.content.trim());
        }
      } catch (err) {
        console.error("[LINE] Event handling error:", err.message);
        await lineReply(replyToken, "系統錯誤，請稍後再試。").catch(() => {});
      }
    }
  }
);

/* ================================================
   CREDIBILITY / FAKE NEWS DETECTION
   ================================================ */

/** GET /api/credibility/status
 *  Returns counts by credibility label.
 */
router.get("/credibility/status", async (req, res) => {
  try {
    const [total, unscored, credible, suspicious, likely_fake] = await Promise.all([
      Article.countDocuments(),
      Article.countDocuments({ $or: [{ "credibility.label": { $exists: false } }, { "credibility.label": null }] }),
      Article.countDocuments({ "credibility.label": "credible" }),
      Article.countDocuments({ "credibility.label": "suspicious" }),
      Article.countDocuments({ "credibility.label": "likely_fake" }),
    ]);
    res.json({ total, unscored, credible, suspicious, likely_fake });
  } catch (err) {
    console.error("[Credibility] Status error:", err.message);
    res.status(500).json({ error: "Failed to fetch credibility status" });
  }
});

/** POST /api/credibility/run
 *  Manually trigger credibility pipeline.
 *  Body: { limit?: number }
 */
router.post("/credibility/run", async (req, res) => {
  const limit = Math.min(Number(req.body?.limit) || 50, 200);
  try {
    runCredibilityPipeline(limit).catch(err =>
      console.error("[Credibility] Manual run failed:", err.message)
    );
    res.json({ message: `Credibility pipeline started for up to ${limit} articles` });
  } catch (err) {
    res.status(500).json({ error: "Failed to start credibility pipeline" });
  }
});

/* ================================================
   TOPIC MODELING
   ================================================ */

/**
 * GET /api/topics/status
 * Returns count of clustered vs unclustered articles, and a count per topic label.
 */
router.get("/topics/status", async (req, res) => {
  try {
    const [total, unclustered] = await Promise.all([
      Article.countDocuments({ analyzed: true }),
      Article.countDocuments({ analyzed: true, $or: [{ "topicCluster.label": { $exists: false } }, { "topicCluster.label": null }] }),
    ]);

    // Count per topic label via aggregation
    const distribution = await Article.aggregate([
      { $match: { analyzed: true, "topicCluster.label": { $ne: null } } },
      { $group: { _id: "$topicCluster.label", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.json({
      total,
      clustered: total - unclustered,
      unclustered,
      distribution: distribution.map(d => ({ label: d._id, count: d.count })),
    });
  } catch (err) {
    console.error("[Topic] Status error:", err.message);
    res.status(500).json({ error: "Failed to fetch topic status" });
  }
});

/**
 * GET /api/topics/distribution
 * Returns per-topic article counts with sentiment breakdown — used by dashboard charts.
 * Query: days? (default 30) — look-back window
 */
router.get("/topics/distribution", async (req, res) => {
  const days = Math.min(Number(req.query.days) || 30, 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const rows = await Article.aggregate([
      {
        $match: {
          analyzed: true,
          "topicCluster.label": { $ne: null },
          fetchedAt: { $gte: since },
        },
      },
      {
        $group: {
          _id: "$topicCluster.label",
          total:    { $sum: 1 },
          positive: { $sum: { $cond: [{ $eq: ["$sentiment.label", "POSITIVE"] }, 1, 0] } },
          negative: { $sum: { $cond: [{ $eq: ["$sentiment.label", "NEGATIVE"] }, 1, 0] } },
          neutral:  { $sum: { $cond: [{ $eq: ["$sentiment.label", "NEUTRAL"]  }, 1, 0] } },
          avgConf:  { $avg: "$topicCluster.confidence" },
        },
      },
      { $sort: { total: -1 } },
    ]);

    const topics = rows.map(r => ({
      label:    r._id,
      total:    r.total,
      positive: r.positive,
      negative: r.negative,
      neutral:  r.neutral,
      avgConfidence: Math.round((r.avgConf || 0) * 100) / 100,
    }));

    res.json({ topics, days, since });
  } catch (err) {
    console.error("[Topic] Distribution error:", err.message);
    res.status(500).json({ error: "Failed to fetch topic distribution" });
  }
});

/**
 * POST /api/topics/run
 * Manually trigger topic modeling pipeline.
 * Body: { limit?: number }
 */
router.post("/topics/run", async (req, res) => {
  const limit = Math.min(Number(req.body?.limit) || 50, 200);
  try {
    runTopicPipeline(limit).catch(err =>
      console.error("[Topic] Manual run failed:", err.message)
    );
    res.json({ message: `Topic pipeline started for up to ${limit} articles` });
  } catch (err) {
    res.status(500).json({ error: "Failed to start topic pipeline" });
  }
});

/* ================================================
   TREND PREDICTION
   ================================================ */

/**
 * GET /api/trends
 * Aggregates daily article counts + sentiment for a keyword (or all articles),
 * then asks Groq to analyze the trend and forecast the next 7 days.
 * Query: keyword? (default all), days? (default 30, max 90)
 */
router.get("/trends", async (req, res) => {
  const days    = Math.min(Number(req.query.days) || 30, 90);
  const keyword = req.query.keyword?.trim() || null;
  const locale  = req.query.locale || "zh";
  const lang    = locale === "en" ? "English" : "繁體中文";
  const since   = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    // ── 1. Build match filter ──────────────────────────────────────────────
    const matchFilter = { analyzed: true, fetchedAt: { $gte: since } };
    if (keyword) {
      matchFilter.$or = [
        { title:    { $regex: keyword, $options: "i" } },
        { keywords: { $regex: keyword, $options: "i" } },
      ];
    }

    // ── 2. Aggregate daily counts + sentiment breakdown ────────────────────
    const rows = await Article.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: {
            y: { $year:  "$fetchedAt" },
            m: { $month: "$fetchedAt" },
            d: { $dayOfMonth: "$fetchedAt" },
          },
          count:    { $sum: 1 },
          positive: { $sum: { $cond: [{ $eq: ["$sentiment.label", "POSITIVE"] }, 1, 0] } },
          negative: { $sum: { $cond: [{ $eq: ["$sentiment.label", "NEGATIVE"] }, 1, 0] } },
          neutral:  { $sum: { $cond: [{ $eq: ["$sentiment.label", "NEUTRAL"]  }, 1, 0] } },
          avgScore: { $avg: "$sentiment.score" },
        },
      },
      { $sort: { "_id.y": 1, "_id.m": 1, "_id.d": 1 } },
    ]);

    if (rows.length === 0) {
      return res.json({ series: [], forecast: null, keyword, days });
    }

    // ── 3. Format series ───────────────────────────────────────────────────
    const series = rows.map(r => ({
      date:     `${r._id.y}-${String(r._id.m).padStart(2,"0")}-${String(r._id.d).padStart(2,"0")}`,
      count:    r.count,
      positive: r.positive,
      negative: r.negative,
      neutral:  r.neutral,
      avgScore: Math.round((r.avgScore || 0) * 100) / 100,
    }));

    // ── 4. Groq trend analysis + 7-day forecast ────────────────────────────
    const seriesText = series
      .map(s => `${s.date}: ${s.count} articles, pos=${s.positive}, neg=${s.negative}, neu=${s.neutral}`)
      .join("\n");

const completion = await groqWithRetry(() => groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content: `You are a media trend analyst. Given a daily time series of article counts and sentiment, provide:
1. A brief trend analysis (2 sentences)
2. A 7-day forecast: predict volume direction and expected sentiment
3. A risk signal based on volatility and negativity

Reply ONLY with JSON (no markdown):
{
  "trend": "2-sentence analysis in ${lang}",
  "forecast": "2-sentence 7-day prediction in ${lang}",
  "direction": "rising"|"stable"|"declining",
  "riskSignal": "low"|"medium"|"high",
  "forecastPoints": [
    {"date":"YYYY-MM-DD","estimatedCount":N,"sentiment":"POSITIVE"|"NEGATIVE"|"NEUTRAL"},
    ...exactly 7 entries for the next 7 calendar days...
  ]
}`,
        },
        {
          role: "user",
          content: `Keyword filter: ${keyword || "none (all articles)"}\nLast ${days} days:\n${seriesText}`,
        },
      ],
    }));

    const raw = completion.choices[0].message.content.trim();
    let forecast = null;
    try {
      forecast = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch {
      const match = raw.match(/\{[\s\S]+\}/);
      if (match) forecast = JSON.parse(match[0]);
    }

    res.json({ series, forecast, keyword, days });
  } catch (err) {
    console.error("[Trends] Error:", err.message);
    res.status(500).json({ error: "Failed to fetch trends" });
  }
});

/* ================================================
   STANCE ANALYSIS
   ================================================ */

// router.get("/stance/status", async (req, res) => {
//   try {
//     const [total, unscored] = await Promise.all([
//       Article.countDocuments({ analyzed: true }),
//       Article.countDocuments({ analyzed: true, $or: [{ "stance.label": { $exists: false } }, { "stance.label": null }] }),
//     ]);

//     const distribution = await Article.aggregate([
//       { $match: { analyzed: true, "stance.label": { $ne: null } } },
//       { $group: { _id: "$stance.label", count: { $sum: 1 } } },
//       { $sort: { count: -1 } },
//     ]);

//     res.json({
//       total,
//       scored: total - unscored,
//       unscored,
//       distribution: distribution.map(d => ({ label: d._id, count: d.count })),
//     });
//   } catch (err) {
//     res.status(500).json({ error: "Failed to fetch stance status" });
//   }
// });

// router.post("/stance/run", async (req, res) => {
//   const limit = Math.min(Number(req.body?.limit) || 50, 200);
//   try {
//     runStancePipeline(limit).catch(err =>
//       console.error("[Stance] Manual run failed:", err.message)
//     );
//     res.json({ message: `Stance pipeline started for up to ${limit} articles` });
//   } catch (err) {
//     res.status(500).json({ error: "Failed to start stance pipeline" });
//   }
// });

/* ================================================
   SENTIMENT SPIKE ALERTS
   ================================================ */

/**
 * GET /api/alerts/status
 * Returns current sentiment snapshot to preview spike conditions.
 */
router.get("/alerts/status", async (req, res) => {
  try {
    const now          = new Date();
    const twoHoursAgo  = new Date(now - 2 * 60 * 60 * 1000);
    const eightHoursAgo = new Date(now - 8 * 60 * 60 * 1000);

    const [recent, baseline] = await Promise.all([
      Article.find({ analyzed: true, fetchedAt: { $gte: twoHoursAgo } }).select("sentiment").lean(),
      Article.find({ analyzed: true, fetchedAt: { $gte: eightHoursAgo, $lt: twoHoursAgo } }).select("sentiment").lean(),
    ]);

    const negRatio = (arr) => {
      const neg = arr.filter(a => a.sentiment?.label === "NEGATIVE").length;
      return arr.length > 0 ? Math.round((neg / arr.length) * 1000) / 10 : 0;
    };

    const recentNeg   = negRatio(recent);
    const baselineNeg = negRatio(baseline);

    res.json({
      recentWindow:   { articles: recent.length,   negativePercent: recentNeg },
      baselineWindow: { articles: baseline.length,  negativePercent: baselineNeg },
      spike:          Math.round((recentNeg - baselineNeg) * 10) / 10,
      spikeThreshold: 15,
      alertConfigured: !!(process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_ALERT_TARGET_ID),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch alert status" });
  }
});

/**
 * POST /api/alerts/test
 * Manually trigger a test LINE push message (for verifying config).
 */
router.post("/alerts/test", async (req, res) => {
  const token    = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const targetId = process.env.LINE_ALERT_TARGET_ID;

  if (!token || !targetId) {
    return res.status(400).json({ error: "LINE_CHANNEL_ACCESS_TOKEN or LINE_ALERT_TARGET_ID not configured in .env" });
  }

  try {
    const fetchFn = (await import("node-fetch")).default;
    const response = await fetchFn("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: targetId,
        messages: [{ type: "text", text: "✅ 輿情警報系統測試成功！\n\n系統已正確設定，將在情緒急升時自動通知您。" }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(502).json({ error: `LINE API error: ${err}` });
    }

    res.json({ success: true, message: "Test alert sent to LINE" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/* ================================================
   YOUTUBE CRAWLER
   ================================================ */

router.post("/crawl/youtube", async (req, res) => {
  const { keyword, channelId, limit = 15, locale = "zh-TW" } = req.body;
  try {
    const { searchYouTube, fetchYouTubeChannel } = await import("./crawlers/youtube.js");
    let videos;

    if (channelId) {
      videos = await fetchYouTubeChannel(channelId, { limit });
    } else if (keyword) {
      videos = await searchYouTube(keyword, { locale, limit });
    } else {
      return res.status(400).json({ error: "keyword or channelId required" });
    }

    const docs = videos.map(v => ({ ...v, crawler: "youtube" }));
    const result = await Article.insertMany(docs, { ordered: false }).catch(err => err);
    const insertedCount = result?.insertedCount ?? result?.result?.nInserted ?? 0;

    res.json({ inserted: insertedCount, skipped: docs.length - insertedCount, total: docs.length });
  } catch (err) {
    console.error("[YouTube] Manual crawl error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;