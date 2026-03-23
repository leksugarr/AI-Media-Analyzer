"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ArticleCard from "@/components/ArticleCard";
import SummaryBox from "@/components/SummaryBox";
import Button from "@/components/Button";
import { useAuth } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";

export default function HomePage() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();

  // Redirect to login if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

const fetchHistory = async () => {
  setHistoryLoading(true);
  try {
    const res = await fetch("/api/history", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data = await res.json();
    setHistory(data.analyses || []);
  } catch {
    setHistory([]);
  } finally {
    setHistoryLoading(false);
  }
};

  const toggleHistory = () => {
    if (!showHistory) fetchHistory();
    setShowHistory((prev) => !prev);
  };

  const summarize = async () => {
    if (!input.trim()) {
      setError("Please paste an article first");
      return;
    }
    if (input.trim().length < 50) {
      setError("Article is too short — please paste more text");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
     const res = await fetch("/api/summarize", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
  body: JSON.stringify({ text: input }),
});

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to analyze article");
        return;
      }

      setResult(data);
    } catch {
      setError("Network error — please check your connection");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) summarize();
  };

  // Show nothing while checking auth
  if (authLoading) return null;
  if (!user) return null;

  return (
    <div>
      <section className="min-h-screen pt-32 pb-20 px-6">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* Header */}
          <div className="text-center space-y-2 mb-8">
            <h1 className="text-4xl font-bold">AI Media Analyzer</h1>
            <p className="text-gray-400 text-sm">
              Paste any article to get an AI summary, sentiment score, and bias detection
            </p>
            <p className="text-xs text-gray-500">Logged in as {user.email}</p>
          </div>

          {/* Input */}
          <ArticleCard>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste your article here... (Cmd/Ctrl + Enter to analyze)"
              className="w-full h-52 bg-transparent outline-none text-base resize-none leading-relaxed"
            />
            <div className="flex justify-between items-center mt-2 pt-3 border-t border-white/10">
              <span className="text-xs text-gray-500">{input.length} characters</span>
              <span className="text-xs text-gray-500">Cmd/Ctrl + Enter to analyze</span>
            </div>
          </ArticleCard>

          {/* Buttons row */}
          <div className="flex gap-3">
            <Button
              onClick={summarize}
              disabled={loading}
              className="relative flex-1 px-8 py-3 font-semibold group overflow-hidden rounded-xl bg-white/10 hover:bg-white/20 transition"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 blur-xl opacity-0 group-hover:opacity-40 transition" />
              <span className="relative z-10 flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                    Analyzing...
                  </>
                ) : "Analyze Article"}
              </span>
            </Button>

            {/* History Toggle Button */}
            <Button
              onClick={toggleHistory}
              className="relative px-6 py-3 font-semibold group overflow-hidden rounded-xl bg-white/10 hover:bg-white/20 transition"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-green-500 to-teal-500 blur-xl opacity-0 group-hover:opacity-40 transition" />
              <span className="relative z-10 flex items-center gap-2">
                {showHistory ? "Hide History" : "History"}
              </span>
            </Button>
          </div>

          {/* Error */}
          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          {/* History Panel */}
          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <ArticleCard className="p-4 space-y-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Analysis History</p>
                  {historyLoading ? (
                    <p className="text-gray-400 text-sm text-center py-4">Loading...</p>
                  ) : history.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-4">No history yet</p>
                  ) : (
                    history.map((item, i) => (
                      <div key={i} className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className={`text-xs font-bold ${
                            item.sentiment?.label === "POSITIVE" ? "text-green-400" :
                            item.sentiment?.label === "NEGATIVE" ? "text-red-400" :
                            "text-yellow-400"
                          }`}>
                            {item.sentiment?.label || "N/A"}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(item.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-300 line-clamp-2">{item.summary}</p>
                        <p className="text-xs text-gray-600 truncate">{item.originalText?.slice(0, 80)}...</p>
                      </div>
                    ))
                  )}
                </ArticleCard>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
                className="space-y-4"
              >
                {/* Summary */}
                <SummaryBox summary={result.summary} />

                {/* Sentiment + Bias row */}
                <div className="grid grid-cols-2 gap-4">
                  {result.sentiment && (
                    <ArticleCard className="p-4 space-y-2">
                      <p className="text-xs text-gray-500 uppercase tracking-wider">Sentiment</p>
                      <div className="flex items-center gap-3">
                        <span className={`text-xl font-bold ${
                          result.sentiment.label === "POSITIVE" ? "text-green-400" :
                          result.sentiment.label === "NEGATIVE" ? "text-red-400" :
                          "text-yellow-400"
                        }`}>
                          {result.sentiment.label}
                        </span>
                        <span className="text-sm text-gray-400">
                          {(result.sentiment.score * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-1.5 mt-1">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            result.sentiment.label === "POSITIVE" ? "bg-green-400" :
                            result.sentiment.label === "NEGATIVE" ? "bg-red-400" : "bg-yellow-400"
                          }`}
                          style={{ width: `${result.sentiment.score * 100}%` }}
                        />
                      </div>
                    </ArticleCard>
                  )}

                  {result.bias && (
                    <ArticleCard className="p-4 space-y-2">
                      <p className="text-xs text-gray-500 uppercase tracking-wider">Political Bias</p>
                      <div className="flex items-center gap-3">
                        <span className={`text-xl font-bold ${
                          result.bias.label === "LEFT" ? "text-blue-400" :
                          result.bias.label === "RIGHT" ? "text-red-400" :
                          result.bias.label === "CENTER" ? "text-green-400" : "text-gray-400"
                        }`}>
                          {result.bias.label}
                        </span>
                      </div>
                      {result.bias.reason && (
                        <p className="text-xs text-gray-400 leading-relaxed">{result.bias.reason}</p>
                      )}
                    </ArticleCard>
                  )}
                </div>

                {/* Keywords */}
                {result.keywords?.length > 0 && (
                  <ArticleCard className="p-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Key Topics</p>
                    <div className="flex flex-wrap gap-2">
                      {result.keywords.map((kw, i) => (
                        <span
                          key={i}
                          className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-sm text-gray-300"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </ArticleCard>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </div>
  );
}