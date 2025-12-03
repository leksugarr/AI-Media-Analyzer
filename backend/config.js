// Configuration file
export const config = {
  // Server
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || "development",

  // Database
  MONGODB_URI:
    process.env.MONGODB_URI || "mongodb://localhost:27017/sentiment_analyzer",

  // API Keys
  HF_API_KEY: process.env.HF_API_KEY,

  // Models
  MODELS: {
    SUMMARIZATION: "facebook/bart-large-cnn",
    SENTIMENT: "nlptown/bert-base-multilingual-uncased-sentiment",
  },

  // Limits
  MAX_TEXT_LENGTH: 5000,
  MIN_TEXT_LENGTH: 50,
  SUMMARY_MIN_LENGTH: 50,
  SUMMARY_MAX_LENGTH: 150,

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || "*",
};

// Validate required environment variables
export const validateConfig = () => {
  // HF_API_KEY is optional - app will use fallback algorithms if not provided
  if (!process.env.HF_API_KEY) {
    console.warn("⚠️  HF_API_KEY not set - using fallback algorithms");
  }
};
