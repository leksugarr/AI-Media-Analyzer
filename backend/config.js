import dotenv from "dotenv";
dotenv.config();

// Configuration file
export const config = {
  // Server
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || "development",

  // Database
  MONGODB_URI: process.env.MONGODB_URI,

  // API Keys
  GROQ_API_KEY: process.env.GROQ_API_KEY,
    TAVILY_API_KEY: process.env.TAVILY_API_KEY,


  // Limits
  MAX_TEXT_LENGTH: 5000,
  MIN_TEXT_LENGTH: 50,

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || "*",
};

// Validate required environment variables
export const validateConfig = () => {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("⚠️  GROQ_API_KEY is required");
  }
  if (!process.env.TAVILY_API_KEY) {
    console.warn("⚠️  TAVILY_API_KEY not set - real time search disabled");
  }
};