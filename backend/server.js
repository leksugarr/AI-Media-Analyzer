import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import { connectDB } from "./db.js";
import { config, validateConfig } from "./config.js";
import routes from "./routes.js";


const app = express();

//tambah
console.log("HF_API_KEY:", config.HF_API_KEY);
/* ---------- Validate config ---------- */
try {
  validateConfig();
} catch (error) {
  console.error("Configuration error:", error.message);
  process.exit(1);
}

/* ---------- Middleware ---------- */
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.CORS_ORIGIN.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));

/* ---------- Health check ---------- */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    environment: config.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

/* ---------- Routes ---------- */
app.use("/api", routes);

/* ---------- 404 ---------- */
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

/* ---------- Error handler ---------- */
app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  res.status(err.status || 500).json({
    error:
      config.NODE_ENV === "development"
        ? err.message
        : "Internal server error",
  });
});

/* ---------- Start server ---------- */
const startServer = async () => {
  try {
    await connectDB();
    console.log("✅ Database connected");
  } catch (err) {
    console.error("❌ DB connection failed:", err.message);
    process.exit(1); // ← tambah ini, biar ketahuan kalau DB gagal
  }

  app.listen(config.PORT, () => {
    console.log(`Backend running on http://localhost:${config.PORT}`);
  });
};
startServer();
