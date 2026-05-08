import { CohereClient } from "cohere-ai";
import { Article } from "./db.js";

const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });

// Cohere's best multilingual model — handles zh-TW, zh-CN, en, ja natively
const MODEL = "embed-multilingual-v3.0";

/**
 * Generate an embedding vector for a single text string.
 * Returns a number[] of length 1024.
 */
export async function embedText(text) {
  const response = await cohere.embed({
    model: MODEL,
    texts: [text.slice(0, 512)],
    inputType: "search_document",
  });
  return response.embeddings[0];
}

/**
 * Generate an embedding for a search query (slightly different input type).
 * Use this for semantic search queries, embedText() for storing articles.
 */
export async function embedQuery(text) {
  const response = await cohere.embed({
    model: MODEL,
    texts: [text.slice(0, 512)],
    inputType: "search_query",
  });
  return response.embeddings[0];
}

/**
 * Cosine similarity between two vectors.
 */
export function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Batch-embed all articles that have been analyzed but not yet embedded.
 * Safe to call repeatedly — skips already-embedded articles.
 * Cohere free tier: 1000 calls/month, batches up to 96 texts per call.
 * We batch in groups of 20 to stay safe and avoid timeouts.
 * @param {number} limit  max articles to process per call (default 30)
 */
export async function runEmbeddingPipeline(limit = 30) {
  console.log("[Embedder] Starting embedding pipeline...");

  const articles = await Article.find({
    analyzed: true,
    $or: [
      { embedding: { $exists: false } },
      { embedding: { $size: 0 } },
      { embedding: null },
    ],
  })
    .sort({ fetchedAt: -1 })
    .limit(limit)
    .lean();

  if (articles.length === 0) {
    console.log("[Embedder] Nothing to embed.");
    return;
  }

  const BATCH_SIZE = 20;
  let success = 0, failed = 0;

  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE);
    const texts = batch.map(a =>
      [a.title, a.description].filter(Boolean).join(" ").trim().slice(0, 512)
    );

    try {
      const response = await cohere.embed({
        model: MODEL,
        texts,
        inputType: "search_document",
      });

      const embeddings = response.embeddings;

      // Save each embedding back to its article
      await Promise.all(
        batch.map((article, idx) =>
          Article.updateOne(
            { _id: article._id },
            { embedding: embeddings[idx] ?? [] }
          )
        )
      );

      success += batch.length;
      console.log(`[Embedder] Batch ${Math.floor(i / BATCH_SIZE) + 1}: embedded ${batch.length} articles`);

      // Small delay between batches to respect rate limits
      if (i + BATCH_SIZE < articles.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (err) {
      failed += batch.length;
      console.error(`[Embedder] Batch failed:`, err.message);
      if (err.message?.includes("429") || err.message?.includes("rate")) {
        console.log("[Embedder] Rate limited — waiting 10s...");
        await new Promise(r => setTimeout(r, 10000));
      }
    }
  }

  console.log(`[Embedder] Done — embedded: ${success}, failed: ${failed}`);
}