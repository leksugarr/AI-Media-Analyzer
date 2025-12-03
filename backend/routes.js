import express from "express";
import { HfInference } from "@huggingface/inference";
import { validateText } from "./middleware.js";
import { config } from "./config.js";

const router = express.Router();

// Only initialize HF if we have a valid API key
let hf = null;
if (config.HF_API_KEY && config.HF_API_KEY.startsWith("hf_")) {
  hf = new HfInference(config.HF_API_KEY);
}

// Simple summarization function - extracts key sentences
function simpleSummarize(text) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  if (sentences.length === 0) return text;
  
  // Return first 30-50% of sentences as summary
  const summaryLength = Math.max(1, Math.ceil(sentences.length * 0.4));
  return sentences.slice(0, summaryLength).join(" ").trim();
}

// Summarization endpoint
router.post("/summarize", validateText, async (req, res) => {
  const { text } = req.body;

  try {
    if (text.split(" ").length < config.MIN_TEXT_LENGTH) {
      return res.status(400).json({
        error: `Text must have at least ${config.MIN_TEXT_LENGTH} words`,
      });
    }

    // Try HF API if initialized
    let summary;
    if (hf) {
      try {
        const summaryResult = await hf.summarization({
          model: config.MODELS.SUMMARIZATION,
          inputs: text,
          parameters: {
            max_length: config.SUMMARY_MAX_LENGTH,
            min_length: config.SUMMARY_MIN_LENGTH,
          },
        });
        summary = summaryResult[0].summary_text;
      } catch (hfError) {
        console.warn("HF API failed, using fallback:", hfError.message);
        summary = simpleSummarize(text);
      }
    } else {
      summary = simpleSummarize(text);
    }

    res.json({
      summary: summary,
      originalLength: text.length,
      summaryLength: summary.length,
      compressionRatio: (
        (1 - summary.length / text.length) *
        100
      ).toFixed(2),
    });
  } catch (error) {
    console.error("Summarization error:", error);
    res
      .status(500)
      .json({
        error:
          process.env.NODE_ENV === "development"
            ? error.message
            : "Failed to summarize text",
      });
  }
});

// Simple sentiment analyzer - counts positive/negative words
function analyzeSentiment(text) {
  const positiveWords = [
    "good", "great", "excellent", "amazing", "wonderful", "fantastic",
    "love", "like", "best", "awesome", "perfect", "beautiful", "happy",
    "positive", "nice", "brilliant", "outstanding"
  ];
  const negativeWords = [
    "bad", "terrible", "awful", "horrible", "worst", "hate", "dislike",
    "poor", "ugly", "sad", "angry", "negative", "disappointing", "useless"
  ];

  const lowerText = text.toLowerCase();
  let positiveCount = 0;
  let negativeCount = 0;

  positiveWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    positiveCount += (lowerText.match(regex) || []).length;
  });

  negativeWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    negativeCount += (lowerText.match(regex) || []).length;
  });

  const total = positiveCount + negativeCount;
  let label = "NEUTRAL";
  let score = 0.5;

  if (total > 0) {
    score = positiveCount / total;
    if (score > 0.6) label = "POSITIVE";
    else if (score < 0.4) label = "NEGATIVE";
    else label = "NEUTRAL";
  }

  return {
    label: label,
    score: parseFloat(score.toFixed(4)),
  };
}

// Sentiment analysis endpoint
router.post("/sentiment", validateText, async (req, res) => {
  const { text } = req.body;

  try {
    // Try HF API if initialized
    let sentiment;
    if (hf) {
      try {
        const sentimentResult = await hf.textClassification({
          model: config.MODELS.SENTIMENT,
          inputs: text,
        });
        sentiment = sentimentResult[0];
      } catch (hfError) {
        console.warn("HF API failed, using fallback:", hfError.message);
        sentiment = analyzeSentiment(text);
      }
    } else {
      sentiment = analyzeSentiment(text);
    }

    res.json({
      sentiment: sentiment,
      allScores: [sentiment],
    });
  } catch (error) {
    console.error("Sentiment analysis error:", error);
    res
      .status(500)
      .json({
        error:
          process.env.NODE_ENV === "development"
            ? error.message
            : "Failed to analyze sentiment",
      });
  }
});

// Combined analysis endpoint
router.post("/analyze", validateText, async (req, res) => {
  const { text } = req.body;

  try {
    if (text.split(" ").length < config.MIN_TEXT_LENGTH) {
      return res.status(400).json({
        error: `Text must have at least ${config.MIN_TEXT_LENGTH} words`,
      });
    }

    let summary, sentiment;

    // Try HF API if initialized
    if (hf) {
      try {
        const [summaryResult, sentimentResult] = await Promise.all([
          hf.summarization({
            model: config.MODELS.SUMMARIZATION,
            inputs: text,
            parameters: {
              max_length: config.SUMMARY_MAX_LENGTH,
              min_length: config.SUMMARY_MIN_LENGTH,
            },
          }),
          hf.textClassification({
            model: config.MODELS.SENTIMENT,
            inputs: text,
          }),
        ]);
        summary = summaryResult[0].summary_text;
        sentiment = sentimentResult[0];
      } catch (hfError) {
        console.warn("HF API failed, using fallback:", hfError.message);
        summary = simpleSummarize(text);
        sentiment = analyzeSentiment(text);
      }
    } else {
      summary = simpleSummarize(text);
      sentiment = analyzeSentiment(text);
    }

    res.json({
      summary: summary,
      sentiment: sentiment,
      allScores: [sentiment],
      originalLength: text.length,
      summaryLength: summary.length,
      compressionRatio: (
        (1 - summary.length / text.length) *
        100
      ).toFixed(2),
    });
  } catch (error) {
    console.error("Analysis error:", error);
    res
      .status(500)
      .json({
        error:
          process.env.NODE_ENV === "development"
            ? error.message
            : "Failed to analyze text",
      });
  }
});

export default router;
