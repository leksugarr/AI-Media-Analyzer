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
  },
  { timestamps: true }
);

articleSchema.index({ url: 1 }, { unique: true });
articleSchema.index({ analyzed: 1, fetchedAt: -1 });
articleSchema.index({ keywords: 1, fetchedAt: -1 });

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