import express from "express";
import { HfInference } from "@huggingface/inference";
import OpenAI from "openai";
import keywordExtractor from "keyword-extractor";

import { validateText } from "./middleware.js";
import { config } from "./config.js";
import { Analysis } from "./db.js";

const router = express.Router();

/* ------------------ AI 初始化 ------------------ */

// HuggingFace
let hf = null;
if (config.HF_API_KEY && config.HF_API_KEY.startsWith("hf_")) {
  hf = new HfInference(config.HF_API_KEY);
}

// OpenAI（翻譯）
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* ------------------ 工具函式 ------------------ */

// 簡易摘要（fallback）
function simpleSummarize(text) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  if (sentences.length === 0) return text;
  const summaryLength = Math.max(1, Math.ceil(sentences.length * 0.4));
  return sentences.slice(0, summaryLength).join(" ").trim();
}

// 簡易情緒分析（fallback）
function analyzeSentiment(text) {
  const positiveWords = [
    "good","great","excellent","amazing","wonderful","fantastic",
    "love","like","best","awesome","perfect","beautiful","happy",
    "positive","nice","brilliant","outstanding"
  ];
  const negativeWords = [
    "bad","terrible","awful","horrible","worst","hate","dislike",
    "poor","ugly","sad","angry","negative","disappointing","useless"
  ];

  const lowerText = text.toLowerCase();
  let positiveCount = 0;
  let negativeCount = 0;

  positiveWords.forEach(word => {
    positiveCount += (lowerText.match(new RegExp(`\\b${word}\\b`, "gi")) || []).length;
  });

  negativeWords.forEach(word => {
    negativeCount += (lowerText.match(new RegExp(`\\b${word}\\b`, "gi")) || []).length;
  });

  const total = positiveCount + negativeCount;
  let label = "NEUTRAL";
  let score = 0.5;

  if (total > 0) {
    score = positiveCount / total;
    if (score > 0.6) label = "POSITIVE";
    else if (score < 0.4) label = "NEGATIVE";
  }

  return { label, score: Number(score.toFixed(4)) };
}

/* ------------------ API ------------------ */

// 單獨摘要
router.post("/summarize", validateText, async (req, res) => {
  const { text } = req.body;

  try {
    let summary;

    if (hf) {
      try {
        const result = await hf.summarization({
          model: config.MODELS.SUMMARIZATION,
          inputs: text,
        });
        summary = result[0].summary_text;
      } catch {
        summary = simpleSummarize(text);
      }
    } else {
      summary = simpleSummarize(text);
    }

    res.json({ summary });
  } catch (err) {
    res.status(500).json({ error: "Failed to summarize" });
  }
});

// 單獨情緒分析
router.post("/sentiment", validateText, async (req, res) => {
  const { text } = req.body;

  try {
    let sentiment;

    if (hf) {
      try {
        const result = await hf.textClassification({
          model: config.MODELS.SENTIMENT,
          inputs: text,
        });
        sentiment = result[0];
      } catch {
        sentiment = analyzeSentiment(text);
      }
    } else {
      sentiment = analyzeSentiment(text);
    }

    res.json({ sentiment });
  } catch (err) {
    res.status(500).json({ error: "Failed to analyze sentiment" });
  }
});

// 🔥 完整 AI 整合分析（主 API）
router.post("/analyze", validateText, async (req, res) => {
  const { text } = req.body;

  try {
    /* #3 多語言翻譯 */
    let translatedText = text;
    try {
      const t = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: `Translate this text to English:\n${text}` }],
      });
      translatedText = t.choices[0].message.content;
    } catch {
      console.warn("Translation skipped");
    }

    /* #1 AI 分析 */
    let summary, sentiment;

    if (hf) {
      try {
        const [s1, s2] = await Promise.all([
          hf.summarization({
            model: config.MODELS.SUMMARIZATION,
            inputs: translatedText,
          }),
          hf.textClassification({
            model: config.MODELS.SENTIMENT,
            inputs: translatedText,
          }),
        ]);
        summary = s1[0].summary_text;
        sentiment = s2[0];
      } catch {
        summary = simpleSummarize(translatedText);
        sentiment = analyzeSentiment(translatedText);
      }
    } else {
      summary = simpleSummarize(translatedText);
      sentiment = analyzeSentiment(translatedText);
    }

    /* #1-2 關鍵字分析 */
    const keywords = keywordExtractor.extract(translatedText, {
      language: "english",
      remove_digits: true,
      remove_duplicates: true,
    });

    /* #4 儲存資料庫 */
    await Analysis.create({
      originalText: text,
      summary,
      sentiment,
    });

    /* 回傳給前端 */
    res.json({
      summary,
      sentiment,
      keywords,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI analysis failed" });
  }
});

export default router;
