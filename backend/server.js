import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./db.js";
import { config, validateConfig } from "./config.js";
import routes from "./routes.js";

dotenv.config();

const app = express();

// Validate configuration
try {
  validateConfig();
} catch (error) {
  console.error("Configuration error:", error.message);
  process.exit(1);
}

// Middleware
app.use(cors({ origin: config.CORS_ORIGIN }));
app.use(express.json());

// Connect to MongoDB
try {
  await connectDB();
} catch (error) {
  console.error("Failed to connect to database:", error.message);
  // Continue anyway - API can still work without DB
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "Backend is running",
    environment: config.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use("/api", routes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    error:
      config.NODE_ENV === "development"
        ? err.message
        : "Internal server error",
  });
});

app.listen(config.PORT, () => {
  console.log(`Backend running on http://localhost:${config.PORT}`);
  console.log(`Environment: ${config.NODE_ENV}`);
});
