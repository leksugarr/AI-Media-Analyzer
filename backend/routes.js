import express from "express";
import { HfInference } from "@huggingface/inference";
import OpenAI from "openai";
import keywordExtractor from "keyword-extractor";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { validateText } from "./middleware.js";
import { config } from "./config.js";
import { Analysis, User } from "./db.js";        // ← add User model
import { crawlArticle } from "./crawler.js";
import { crawlPTTBoard, crawlPTTArticle } from "./crawlers/ptt.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_in_production";

/* ---------- AI init ---------- */
let hf = null;
if (config.HF_API_KEY?.startsWith("hf_")) {
  hf = new HfInference(config.HF_API_KEY);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ---------- Utils ---------- */
function simpleSummarize(text) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  return sentences.slice(0, Math.max(1, Math.floor(sentences.length * 0.4))).join(" ");
}

function analyzeSentiment(text) {
  const positive = ["good", "great", "excellent", "amazing", "love"];
  const negative = ["bad", "terrible", "awful", "hate", "worst"];
  let p = 0, n = 0;
  const t = text.toLowerCase();
  positive.forEach(w => (p += (t.match(new RegExp(`\\b${w}\\b`, "g")) || []).length));
  negative.forEach(w => (n += (t.match(new RegExp(`\\b${w}\\b`, "g")) || []).length));
  const total = p + n;
  if (!total) return { label: "NEUTRAL", score: 0.5 };
  const score = p / total;
  return {
    label: score > 0.6 ? "POSITIVE" : score < 0.4 ? "NEGATIVE" : "NEUTRAL",
    score: Number(score.toFixed(3)),
  };
}

/* ================================================
   AUTH ROUTES
   ================================================ */

/* POST /api/auth/signup */
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

/* POST /api/auth/login */
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
    let translated = text;
    try {
      const t = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: `Translate to English:\n${text}` }],
      });
      translated = t.choices[0].message.content;
    } catch {}

    let summary, sentiment;

    if (hf) {
      try {
        const [s1, s2] = await Promise.all([
          hf.summarization({ model: config.MODELS.SUMMARIZATION, inputs: translated }),
          hf.textClassification({ model: config.MODELS.SENTIMENT, inputs: translated }),
        ]);
        summary = s1[0].summary_text;
        sentiment = s2[0];
      } catch {
        summary = simpleSummarize(translated);
        sentiment = analyzeSentiment(translated);
      }
    } else {
      summary = simpleSummarize(translated);
      sentiment = analyzeSentiment(translated);
    }

    const keywords = keywordExtractor.extract(translated, {
      language: "english",
      remove_duplicates: true,
    });

    try {
      await Analysis.create({ originalText: text, summary, sentiment });
    } catch {}

    res.json({ summary, sentiment, keywords });
  } catch {
    res.status(500).json({ error: "Analysis failed" });
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

export default router;