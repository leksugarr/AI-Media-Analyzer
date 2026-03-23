// ADD THIS to your existing db.js — paste alongside your Analysis model

import mongoose from "mongoose";

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