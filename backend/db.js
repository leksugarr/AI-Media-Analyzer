import mongoose from "mongoose";

export const connectDB = async () => {
  const MONGODB_URI = process.env.MONGODB_URI;

  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI tidak ada di .env!");
  }

  await mongoose.connect(MONGODB_URI);
  console.log("✅ MongoDB connected successfully");
};

export default mongoose;

// ─── Analysis Schema ───────────────────────────────────────────────────────────
const analysisSchema = new mongoose.Schema({
  originalText: {
    type: String,
    required: true,
    maxlength: 5000,
  },
  summary: {
    type: String,
    required: false,
  },
  sentiment: {
    label: String,
    score: Number,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  userId: {
    type: String,
    default: "anonymous",
  },
});

export const Analysis = mongoose.model("Analysis", analysisSchema);

// ─── User Schema ───────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);

// ─── Conversation Schema ───────────────────────────────────────────────────────
const messageSchema = new mongoose.Schema({
  role:    { type: String, enum: ["user", "assistant"], required: true },
  content: { type: mongoose.Schema.Types.Mixed, required: true },
});

const conversationSchema = new mongoose.Schema({
  userId:    { type: String, required: true },
  title:     { type: String, required: true },
  messages:  [messageSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const Conversation = mongoose.model("Conversation", conversationSchema);

// ─── Article Schema (Google News / PTT / Dcard) ────────────────────────────────
// Stores raw crawled articles before analysis is run on them.
// The `analyzed` flag lets the scheduler pick up unprocessed articles.
const articleSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true, trim: true },
    url:         { type: String, required: true },
    source:      { type: String, default: "" },
    description: { type: String, default: "" },
    content:     { type: String, default: "" },

    crawler: {
      type: String,
      enum: ["googleNews", "ptt", "dcard", "youtube", "manual"],
      required: true,
    },
    keywords:    { type: [String], default: [] },
    topic:       { type: String, default: "" },
    locale:      { type: String, default: "zh-TW" },

    publishedAt: { type: Date, default: Date.now },
    fetchedAt:   { type: Date, default: Date.now },

    analyzed: { type: Boolean, default: false },
    sentiment: {
      label: { type: String, default: "" },
      score: { type: Number, default: null },
    },
    summary: { type: String, default: "" },
    embedding: { type: [Number], default: [] },

    // ─── Credibility (Groq-based fake news scoring) ───────────────────────────
    credibility: {
      label:      { type: String, enum: ["credible", "suspicious", "likely_fake"], default: null },
      score:      { type: Number, default: null },   // 0–1, higher = more suspicious
      reason:     { type: String, default: "" },     // short Groq explanation
      analyzedAt: { type: Date,   default: null },
    },

    // ─── Topic Cluster (Groq-based topic modeling) ────────────────────────────
    topicCluster: {
      label:      { type: String, default: null },   // e.g. "科技產業", "政治選舉", "經濟金融"
      confidence: { type: Number, default: null },   // 0–1
      assignedAt: { type: Date,   default: null },
    },


      // ─── Stance Analysis (Groq-based) ────────────────────────────────────────────
stance: {
      label:      { type: String, enum: ["支持", "反對", "中立"], default: null },
      reason:     { type: String, default: "" },
      analyzedAt: { type: Date, default: null },
    },

    // ─── Deduplication ────────────────────────────────────────────────────────
    isDuplicate:  { type: Boolean, default: false },
    canonicalId:  { type: mongoose.Schema.Types.ObjectId, ref: "Article", default: null },
    
  },
  { timestamps: true }
);

articleSchema.index({ url: 1 }, { unique: true });
articleSchema.index({ analyzed: 1, fetchedAt: -1 });
articleSchema.index({ keywords: 1, fetchedAt: -1 });
articleSchema.index({ embedding: 1 });

export const Article = mongoose.model("Article", articleSchema);

// ─── Report Schema ─────────────────────────────────────────────────────────────
const reportSchema = new mongoose.Schema({
  type:        { type: String, enum: ["weekly", "daily", "manual"], required: true },
  period:      { from: Date, to: Date },
  narrative:   { type: String, default: "" },
  stats:       { total: Number, positive: Number, negative: Number, neutral: Number },
  topArticles: [{ title: String, url: String, sentiment: String, source: String }],
  createdAt:   { type: Date, default: Date.now },
});

export const Report = mongoose.model("Report", reportSchema);

// ─── Keyword Suggestion Schema ─────────────────────────────────────────────────
// Groq-suggested trending keywords waiting for user approval
const keywordSuggestionSchema = new mongoose.Schema({
  keyword:     { type: String, required: true, trim: true },
  reason:      { type: String, default: "" },   // Groq's explanation of why it's trending
  source:      { type: String, default: "" },   // which articles triggered the suggestion
  status:      { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  suggestedAt: { type: Date, default: Date.now },
  decidedAt:   { type: Date, default: null },
});

keywordSuggestionSchema.index({ keyword: 1, status: 1 });
export const KeywordSuggestion = mongoose.model("KeywordSuggestion", keywordSuggestionSchema);

// ─── Watchlist Keyword Schema ──────────────────────────────────────────────────
// User-approved keywords the crawler actively monitors every cycle
const watchlistKeywordSchema = new mongoose.Schema({
  keyword:   { type: String, required: true, trim: true, unique: true },
  locale:    { type: String, default: "zh-TW" },
  label:     { type: String, default: "" },   // display name
  addedAt:   { type: Date, default: Date.now },
  active:    { type: Boolean, default: true },
});

export const WatchlistKeyword = mongoose.model("WatchlistKeyword", watchlistKeywordSchema);