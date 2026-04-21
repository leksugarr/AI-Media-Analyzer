// ADD THIS to your existing db.js — paste alongside your Analysis model


import mongoose from "mongoose";


export const connectDB = async () => {
  try {
    const MONGODB_URI = process.env.MONGODB_URI; 
    await mongoose.connect(MONGODB_URI);
    console.log("MongoDB connected successfully yes sir");
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

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true }, // bcrypt hashed
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);

// Also install these if not already present:
// npm install bcryptjs jsonwebtoken