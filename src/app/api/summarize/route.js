// src/app/api/summarize/route.js

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";
const HF_API_KEY = process.env.HF_API_KEY || "";

async function hfFetch(model, body, timeoutMs = 60000) {
  const res = await fetch(
    `https://router.huggingface.co/hf-inference/models/${model}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_API_KEY}`,
        "Content-Type": "application/json",
        "x-wait-for-model": "true",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    }
  );

  const data = await res.json();

  if (!res.ok || data.error) {
    console.error(`HF model ${model} error:`, data.error || res.status);
    return null;
  }

  return data;
}

// Fallback: extract first 3 sentences as summary
function fallbackSummary(text) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  return sentences.slice(0, 3).join(" ").trim() || text.slice(0, 300);
}

// Simple keyword extractor
function extractKeywords(text) {
  const stopwords = new Set([
    "the","a","an","and","or","but","in","on","at","to","for","of","with",
    "by","from","is","was","are","were","be","been","being","have","has",
    "had","do","does","did","will","would","could","should","may","might",
    "it","its","this","that","these","those","i","we","you","he","she","they",
    "said","also","not","as","so","if","than","then","when","where","who",
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 4 && !stopwords.has(w));

  const freq = {};
  words.forEach((w) => (freq[w] = (freq[w] || 0) + 1));

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);
}

export async function POST(request) {
  const body = await request.json();
  const { text } = body;

  if (!text || text.trim().length < 50) {
    return Response.json(
      { error: "Please provide at least 50 characters of text" },
      { status: 400 }
    );
  }

  // --- Try Express backend first ---
  try {
    const res = await fetch(`${BACKEND_URL}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(30000),
    });
    if (res.ok) {
      return Response.json(await res.json(), { status: 200 });
    }
  } catch {
    // Backend unreachable, fall through
  }

  // --- Hugging Face ---
  if (!HF_API_KEY) {
    return Response.json(
      { error: "Please set HF_API_KEY in .env.local" },
      { status: 503 }
    );
  }

  // Run both models in parallel
  const [summaryData, sentimentData] = await Promise.all([
    hfFetch("facebook/bart-large-cnn", {
      inputs: text.slice(0, 1024),
      parameters: { max_length: 150, min_length: 40, do_sample: false },
    }),
    hfFetch("cardiffnlp/twitter-roberta-base-sentiment-latest", {
      inputs: text.slice(0, 512),
    }),
  ]);

  // Summary — use HF result or fall back to first 3 sentences
  const summary = summaryData?.[0]?.summary_text || fallbackSummary(text);

  // Sentiment — use HF result or fall back to neutral
  let sentiment = { label: "NEUTRAL", score: 0.5 };
  const top = sentimentData?.[0]?.[0];
  if (top) {
    const labelMap = { positive: "POSITIVE", negative: "NEGATIVE", neutral: "NEUTRAL" };
    sentiment = {
      label: labelMap[top.label.toLowerCase()] || top.label.toUpperCase(),
      score: Number(top.score.toFixed(3)),
    };
  }

  const keywords = extractKeywords(text);

  return Response.json({ summary, sentiment, keywords }, { status: 200 });
}