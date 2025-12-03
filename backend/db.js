import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/sentiment_analyzer";

export const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.warn("MongoDB connection warning (optional):", error.message);
    // Don't exit - API can still work without DB
  }
};

export default mongoose;

// Analysis Schema for storing results
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
