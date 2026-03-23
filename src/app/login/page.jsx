"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ArticleCard from "@/components/ArticleCard";
import Button from "@/components/Button";
import { useAuth } from "@/context/AuthContext";
import { motion } from "framer-motion";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState({ text: "", type: "" });
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      setMessage({ text: "Please fill in all fields", type: "error" });
      return;
    }

    setLoading(true);
    setMessage({ text: "", type: "" });

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        login(data.user); // save to AuthContext + localStorage
        setMessage({ text: "Login successful! Redirecting...", type: "success" });
        setTimeout(() => router.push("/"), 800);
      } else {
        setMessage({ text: data.message || "Login failed", type: "error" });
      }
    } catch {
      setMessage({ text: "Network error. Please try again.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="max-w-md w-full"
      >
        <ArticleCard className="p-6 space-y-5">
          <h1 className="text-2xl font-bold text-center mb-2">Login</h1>

          <input
            type="email"
            placeholder="Email"
            className="w-full p-3 bg-black/20 rounded-xl outline-none border border-white/10 focus:border-white/30 transition"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
          />

          <input
            type="password"
            placeholder="Password"
            className="w-full p-3 bg-black/20 rounded-xl outline-none border border-white/10 focus:border-white/30 transition"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
          />

          <Button
            onClick={handleLogin}
            disabled={loading}
            className="relative w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 transition group overflow-hidden"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-500 blur-lg opacity-0 group-hover:opacity-40 transition" />
            <span className="relative z-10 font-semibold">
              {loading ? "Logging in..." : "Login"}
            </span>
          </Button>

          {message.text && (
            <p className={`text-center text-sm ${message.type === "error" ? "text-red-400" : "text-green-400"}`}>
              {message.text}
            </p>
          )}

          <p className="text-center text-gray-400 text-sm">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-blue-400 hover:underline">
              Sign Up
            </Link>
          </p>
        </ArticleCard>
      </motion.div>
    </div>
  );
}