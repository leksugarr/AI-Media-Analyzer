import express from "express";
import Groq from "groq-sdk";
import { tavily } from "tavily";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { validateText } from "./middleware.js";
import { crawlArticle } from "./crawler.js";
import { crawlPTTBoard, crawlPTTArticle } from "./crawlers/ptt.js";          // ← fixed path
import { Analysis, User, Conversation, Article } from "./db.js";
import {
  searchGoogleNews,
  fetchNewsByTopic,
  resolveGoogleNewsUrl,
  VALID_TOPICS,
  VALID_LOCALES,
} from "./crawlers/googleNews.js";

const router = express.Router();
const JWT_SECRET = "dev_secret_change_in_production";

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
// const tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY });

/* ─── Groq Sentiment Helper ────────────────────────────────────────────────── */
async function analyzeSentiment(text) {
  const input = text.slice(0, 200);
  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 20,
    messages: [
      {
        role: "system",
        content: `Classify sentiment. Reply ONLY with JSON: {"label":"POSITIVE"|"NEGATIVE"|"NEUTRAL","score":0.0}`,
      },
      { role: "user", content: input },
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
    const completion = await groq.chat.completions.create({
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
    });

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
    // try {
    //   const searchResult = await tavilyClient.search(
    //     typeof lastUserMsg === "string" ? lastUserMsg : JSON.stringify(lastUserMsg),
    //     { maxResults: 3, searchDepth: "basic" }
    //   );
    //   searchContext = searchResult.results
    //     .map((r) => `${r.title}: ${r.content}`)
    //     .join("\n\n");
    // } catch (err) {
    //   console.error("Tavily search error:", err.message);
    // }

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

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [systemPrompt, ...payload],
    });

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
router.post("/news/search", async (req, res) => {
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
router.get("/news/latest", async (req, res) => {
  const { keyword, crawler, analyzed, limit = 20, page = 1 } = req.query;

  const clampedLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * clampedLimit;

  const filter = {};
  if (keyword)              filter.title    = { $regex: keyword, $options: "i" };
  if (crawler)              filter.crawler  = crawler;
  if (analyzed === "true")  filter.analyzed = true;
  if (analyzed === "false") filter.analyzed = false;

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

export default router;