"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import ArticleCard from "@/components/ArticleCard";
import { motion } from "framer-motion";

// ─── Keyword frequency counter ─────────────────────────────────────────────────
function countKeywords(articles) {
  const freq = {};
  for (const a of articles) {
    for (const kw of a.keywords || []) {
      const k = kw.trim().toLowerCase();
      if (k) freq[k] = (freq[k] || 0) + 1;
    }
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
}

// ─── Bar chart ─────────────────────────────────────────────────────────────────
function KeywordBar({ keyword, count, max, index }) {
  const pct = Math.round((count / max) * 100);
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center gap-3 group"
    >
      <div className="w-28 text-right text-xs text-gray-400 truncate group-hover:text-white transition">
        {keyword}
      </div>
      <div className="flex-1 h-6 bg-white/5 rounded-lg overflow-hidden relative">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ delay: index * 0.05 + 0.2, duration: 0.6, ease: "easeOut" }}
          className="h-full rounded-lg bg-gradient-to-r from-blue-600/70 to-indigo-500/70"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">
          {count}
        </span>
      </div>
    </motion.div>
  );
}

// ─── Sentiment badge ───────────────────────────────────────────────────────────
function SentimentBadge({ label }) {
  const colors = {
    POSITIVE: "text-green-400 bg-green-400/10 border-green-500/20",
    NEGATIVE: "text-red-400 bg-red-400/10 border-red-500/20",
    NEUTRAL:  "text-yellow-400 bg-yellow-400/10 border-yellow-500/20",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] border font-medium ${colors[label] || colors.NEUTRAL}`}>
      {label || "—"}
    </span>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();

  const [articles, setArticles]     = useState([]);
  const [status, setStatus]         = useState(null);
  const [loading, setLoading]       = useState(true);
  const [processing, setProcessing] = useState(false);
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterAnalyzed, setFilterAnalyzed] = useState("");
  const [msg, setMsg]               = useState("");

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) { fetchArticles(); fetchStatus(); }
  }, [user, page, filterAnalyzed]);

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 50, page });
      if (filterAnalyzed !== "") params.set("analyzed", filterAnalyzed);
      const res = await fetch(`/api/news?${params}`);
      const data = await res.json();
      setArticles(data.articles || []);
      setTotalPages(data.pages || 1);
    } catch { setArticles([]); }
    setLoading(false);
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/sentiment-status");
      const data = await res.json();
      setStatus(data);
    } catch {}
  };

  const runBatch = async () => {
    setProcessing(true);
    setMsg("");
    try {
      const res = await fetch("/api/sentiment-batch", { method: "POST" });
      const data = await res.json();
      setMsg(data.message || "Done");
      fetchArticles();
      fetchStatus();
    } catch { setMsg("Failed to run batch"); }
    setProcessing(false);
  };

  const keywords = countKeywords(articles);
  const maxCount = keywords[0]?.[1] || 1;

  const sentimentCounts = articles.reduce((acc, a) => {
    const l = a.sentiment?.label || "UNKNOWN";
    acc[l] = (acc[l] || 0) + 1;
    return acc;
  }, {});

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen pt-28 pb-20 px-6">
      <div className="max-w-5xl mx-auto flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-gray-400 text-sm mt-1">Keyword frequency & article insights</p>
          </div>
          <button
            onClick={runBatch}
            disabled={processing}
            className="px-4 py-2 bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/30 rounded-xl text-sm font-medium transition disabled:opacity-40"
          >
            {processing ? "Processing..." : "▶ Run Sentiment Batch"}
          </button>
        </div>

        {msg && <p className="text-xs text-green-400 text-center">{msg}</p>}

        {/* Status cards */}
        {status && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Total articles", value: status.total },
              { label: "Analyzed",       value: status.analyzed,   color: "text-green-400" },
              { label: "Pending",        value: status.unanalyzed, color: "text-yellow-400" },
            ].map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                <ArticleCard className="p-4 text-center">
                  <p className={`text-2xl font-bold ${s.color || "text-white"}`}>{s.value ?? "—"}</p>
                  <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                </ArticleCard>
              </motion.div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Keyword frequency */}
          <ArticleCard className="flex flex-col gap-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Keyword frequency</p>
            {loading ? (
              <p className="text-gray-600 text-sm text-center py-8">Loading...</p>
            ) : keywords.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-8">No keywords found</p>
            ) : (
              <div className="flex flex-col gap-2">
                {keywords.map(([kw, count], i) => (
                  <KeywordBar key={kw} keyword={kw} count={count} max={maxCount} index={i} />
                ))}
              </div>
            )}
          </ArticleCard>

          {/* Sentiment breakdown */}
          <ArticleCard className="flex flex-col gap-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Sentiment breakdown</p>
            {loading ? (
              <p className="text-gray-600 text-sm text-center py-8">Loading...</p>
            ) : (
              <div className="flex flex-col gap-3 mt-2">
                {Object.entries(sentimentCounts).map(([label, count], i) => {
                  const pct = Math.round((count / articles.length) * 100);
                  const color = label === "POSITIVE" ? "bg-green-500/60" : label === "NEGATIVE" ? "bg-red-500/60" : "bg-yellow-500/60";
                  return (
                    <motion.div key={label} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.1 }} className="flex flex-col gap-1">
                      <div className="flex justify-between text-xs">
                        <SentimentBadge label={label} />
                        <span className="text-gray-400">{count} articles ({pct}%)</span>
                      </div>
                      <div className="w-full bg-white/5 rounded-full h-2">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ delay: i * 0.1 + 0.3, duration: 0.6, ease: "easeOut" }}
                          className={`h-2 rounded-full ${color}`}
                        />
                      </div>
                    </motion.div>
                  );
                })}
                {Object.keys(sentimentCounts).length === 0 && (
                  <p className="text-gray-600 text-sm text-center py-8">No analyzed articles yet — run batch first</p>
                )}
              </div>
            )}
          </ArticleCard>
        </div>

        {/* Article list */}
        <ArticleCard className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Articles</p>
            <select
              value={filterAnalyzed}
              onChange={e => { setFilterAnalyzed(e.target.value); setPage(1); }}
              className="text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-gray-300 outline-none"
            >
              <option value="">All</option>
              <option value="true">Analyzed</option>
              <option value="false">Pending</option>
            </select>
          </div>

          {loading ? (
            <p className="text-gray-600 text-sm text-center py-8">Loading...</p>
          ) : articles.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-8">No articles found</p>
          ) : (
            <div className="flex flex-col gap-2">
              {articles.map((a, i) => (
                <motion.div
                  key={a._id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="flex items-start justify-between gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition"
                >
                  <div className="flex-1 min-w-0">
                    <a href={a.url} target="_blank" rel="noopener noreferrer"
                      className="text-sm text-gray-200 hover:text-white transition truncate block">
                      {a.title}
                    </a>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <span className="text-[10px] text-gray-600">{a.source}</span>
                      {a.keywords?.slice(0, 3).map(k => (
                        <span key={k} className="text-[10px] px-1.5 py-0.5 bg-white/5 rounded text-gray-500">{k}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {a.analyzed ? <SentimentBadge label={a.sentiment?.label} /> : (
                      <span className="text-[10px] text-gray-600 border border-white/10 rounded-full px-2 py-0.5">pending</span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1 text-xs bg-white/5 rounded-lg disabled:opacity-30 hover:bg-white/10 transition">← Prev</button>
              <span className="text-xs text-gray-500 px-2 py-1">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1 text-xs bg-white/5 rounded-lg disabled:opacity-30 hover:bg-white/10 transition">Next →</button>
            </div>
          )}
        </ArticleCard>

      </div>
    </div>
  );
}