"use client";
import { useState } from "react";
import Link from "next/link";
import ArticleCard from "@/components/ArticleCard";
import Button from "@/components/Button";
import { motion } from "framer-motion";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const signup = async () => {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    setMessage(data.message);
  };

  return (
    <div>
      <div className="min-h-screen flex justify-center items-center px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35 }}
        >
          <ArticleCard className="max-w-md w-full p-6 space-y-6">
            <h1 className="text-2xl font-bold text-center mb-2">
              Create Account
            </h1>

            <input
              type="email"
              placeholder="Email"
              className="w-full p-3 bg-black/20 rounded-xl outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              type="password"
              placeholder="Password"
              className="w-full p-3 bg-black/20 rounded-xl outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <Button
              onClick={signup}
              className="relative w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 transition group overflow-hidden"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-pink-500 to-purple-500 blur-lg opacity-0 group-hover:opacity-40 transition"></span>
              <span className="relative z-10 font-semibold">Sign Up</span>
            </Button>

            {message && (
              <p className="text-center text-sm text-green-400">{message}</p>
            )}

            <p className="text-center text-gray-400 text-sm">
              Already have an account?{" "}
              <Link href="/login" className="text-blue-400 hover:underline">
                Login
              </Link>
            </p>
          </ArticleCard>
        </motion.div>
      </div>
    </div>
  );
}
