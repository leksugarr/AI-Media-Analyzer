// ADD THIS to your existing db.js — paste alongside your Analysis model


import mongoose from "mongoose";


export const connectDB = async () => {
  const MONGODB_URI = process.env.MONGODB_URI;
  
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI tidak ada di .env!");
  }

  await mongoose.connect(MONGODB_URI); // biarkan error muncul ke atas
  console.log("✅ MongoDB connected successfully");
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

//conversation schema -- BARU
const messageSchema=new mongoose.Schema({
  role:{type:String, enum:["user","assistant"], required:true},
  content:{type:mongoose.Schema.Types.Mixed, required:true}, 
})

const conversationSchema=new mongoose.Schema({
  userId:{type:String, required:true},
  title:{type:String, required:true},//ambil pesan dari pesan pertama user
  messages:[messageSchema],
  createdAt:{type:Date, default:Date.now},
  updatedAt:{type:Date, default:Date.now},
});

export const Conversation=mongoose.model("Conversation", conversationSchema);
// Also install these if not already present:
// npm install bcryptjs jsonwebtoken