import express from "express";
import { HfInference } from "@huggingface/inference";
import OpenAI from "openai";
import keywordExtractor from "keyword-extractor";

import { validateText } from "./middleware.js";
import { config } from "./config.js";
import { Analysis } from "./db.js";
import { crawlArticle } from "./crawler.js";

const router = express.Router();

/* ---------- AI init ---------- */
let hf = null;
if (config.HF_API_KEY?.startsWith("hf_")) {
  hf = new HfInference(config.HF_API_KEY);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* ---------- Utils ---------- */
function simpleSummarize(text) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  return sentences.slice(0, Math.max(1, sentences.length * 0.4)).join(" ");
}

function analyzeSentiment(text) {
  const positive = ["good", "great", "excellent", "amazing", "love"];
  const negative = ["bad", "terrible", "awful", "hate", "worst"];

  let p = 0,
    n = 0;
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

/* ---------- Analyze text ---------- */
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

/* ---------- Crawl + Analyze ---------- */
router.post("/crawl", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL required" });

  try {
    const text = await crawlArticle(url);

    req.body.text = text;
    return router.handle(req, res); // reuse analyze
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Crawl failed" });
  }
});

export default router;
