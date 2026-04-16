import express from "express";
import Groq from "groq-sdk";
import {tavily} from "@tavily/core";
import keywordExtractor from "keyword-extractor";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { validateText } from "./middleware.js";
import { config } from "./config.js";
import { Analysis, User } from "./db.js";        // ← add User model
import { crawlArticle } from "./crawler.js";
import { crawlPTTBoard, crawlPTTArticle } from "./backend/crawlers/ptt.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_in_production";

/*------auth helper------*/
function getUserFromToken(req) {
  try {
    const auth = req.headers.authorization;
    console.log("🔑 Auth header:", auth); // ← tambah ini
    if (!auth?.startsWith("Bearer ")) return null;
    const token = auth.split(" ")[1];
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    console.log("🔑 Token error:", err.message); // ← tambah ini
    return null;
  }
}
/* ---------- AI init ---------- */
const groq=new Groq({ apiKey: process.env.GROQ_API_KEY });
const tavilyClient=tavily({ apiKey: process.env.TAVILY_API_KEY });
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
   ANALYZE - summarize + sentiment via Groq
   ================================================ */
router.post("/analyze", validateText, async (req, res) => {
  const { text } = req.body;

   try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
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
}`
        },
        {
          role: "user",
          content: text
        }
      ],
    });

    const raw = completion.choices[0].message.content.replace(/```json|```/g, "").trim();
    const data = JSON.parse(raw);

    const userInfo = getUserFromToken(req);
    await Analysis.create({
      originalText: text,
      summary: data.summary,
      sentiment: data.sentiment,
      userId: userInfo?.userId || "anonymous",
    }).catch(err => console.error("MongoDB save error:", err.message));

    res.json({
      summary: data.summary,
      sentiment: data.sentiment,
      keywords: data.keywords,
    });
  } catch (err) {
    console.error("Analyze error:", err.message);
    res.status(500).json({ error: "Analysis failed" });
  }
});
/* ================================================
TOPIC CHATBOT - GROQ +TAVILY real time search
/* ================================================*/
router.post("/topic-analyze",async (req, res)=>{
const{messages}=req.body;
if(!messages||!messages.length)
return res.status(400).json({error:"Messages required"});
 try {
    // ambil pesan terakhir user untuk search
    const lastUserMsg = messages.filter(m => m.role === "user").at(-1)?.content;

    // search real-time info via Tavily
    let searchContext = "";
    try {
      const searchResult = await tavilyClient.search(lastUserMsg, {
        maxResults: 3,
        searchDepth: "basic",
      });
      searchContext = searchResult.results
        .map(r => `${r.title}: ${r.content}`)
        .join("\n\n");
    } catch (err) {
      console.error("Tavily search error:", err.message);
    }

    const systemPrompt = {
      role: "system",
      content: `You are a real-world topic analyzer chatbot. You have access to current web information.

${searchContext ? `Current information from the web:\n${searchContext}\n\n` : ""}

When the user asks about a topic, respond ONLY with a valid JSON object, no markdown:
{
  "reply": "friendly conversational response based on real current information",
  "category": "Environment / Economy / Technology / Health / Politics / Society / Science",
  "subtopics": ["subtopic1", "subtopic2", "subtopic3"],
  "trend_labels": ["2019", "2020", "2021", "2022", "2023", "2024"],
  "trend_positive": [40, 45, 50, 55, 60, 65],
  "trend_negative": [45, 40, 38, 32, 28, 25]
}

If the user is just chatting (greetings, follow-up questions), respond ONLY with:
{ "reply": "your conversational response" }

Always respond in the same language the user uses. Always valid JSON, no markdown fences.`
    };

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [systemPrompt, ...messages],
    });

    const raw = completion.choices[0].message.content.replace(/```json|```/g, "").trim();
    const data = JSON.parse(raw);

    // simpan ke MongoDB kalau ada kategori (bukan sekadar chat)
    if (data.category) {
      const userInfo = getUserFromToken(req);
      await Analysis.create({
        originalText: lastUserMsg,
        summary: `Topic: ${data.category} — ${data.reply}`,
        sentiment: { label: "NEUTRAL", score: 0.5 },
        userId: userInfo?.userId || "anonymous",
      }).catch(err => console.error("MongoDB save error:", err.message));
    }

    res.json(data);
  } catch (err) {
    console.error("Topic analyze error:", err.message);
    res.status(500).json({ error: "Topic analysis failed" });
  }



}
);







   /*===CRAWL===========================================*/
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

//HISTORY
// Tambahkan di backend/routes.js
// GET /api/history — fetch 20 latest analyses dari MongoDB

router.get("/history", async (req, res) => {
  try {
    const userInfo = getUserFromToken(req);
    if (!userInfo) {
      return res.status(401).json({ error: "Unauthorized" });
    }
 
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
 

export default router;