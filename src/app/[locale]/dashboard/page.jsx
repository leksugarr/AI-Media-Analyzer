"use client";
import TrendPredictionPanel from "@/components/TrendPredictionPanel";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import ArticleCard from "@/components/ArticleCard";
import FilterSidebar from "@/components/FilterSidebar";
import KeywordWatchlistPanel from "@/components/KeywordWatchlistPanel";
import KeywordHeatmap from "@/components/KeywordHeatmap";
import TopicModelingPanel from "@/components/TopicModelingPanel";
import { motion } from "framer-motion";
import StancePanel from "@/components/StancePanel";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useTranslations, useLocale } from "next-intl";

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
function DashboardPageInner() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations("dashboard");
  const locale = useLocale();

  const [articles, setArticles]     = useState([]);
  const [status, setStatus]         = useState(null);
  const [loading, setLoading]       = useState(true);
  const [processing, setProcessing] = useState(false);
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterAnalyzed, setFilterAnalyzed] = useState("");
  const [msg, setMsg]               = useState("");
  const [reports, setReports]       = useState([]);
  const [reportMsg, setReportMsg]   = useState("");
  const [genReport, setGenReport]   = useState(false);
  const [showReports, setShowReports] = useState(true);

  // ── Semantic search state ─────────────────────────────────────────────────
  const [searchMode, setSearchMode]       = useState("keyword"); // "keyword" | "semantic"
  const [semanticQuery, setSemanticQuery] = useState("");
  const [semanticResults, setSemanticResults] = useState(null); // null = not searched yet
  const [semanticLoading, setSemanticLoading] = useState(false);

  // ── Similar articles drawer ───────────────────────────────────────────────
  const [similarFor, setSimilarFor]     = useState(null); // article object
  const [similarArticles, setSimilarArticles] = useState([]);
  const [similarLoading, setSimilarLoading]   = useState(false);

  // ── Filter state ──────────────────────────────────────────────────────────
  const [filters, setFilters] = useState({ keyword: "", dateFrom: "", dateTo: "", source: "", sentiment: "" });

  // ── Overall sentiment (unfiltered — always shows full corpus) ─────────────
  const [overallSentiment, setOverallSentiment] = useState({});

  useEffect(() => {
    if (!authLoading && !user) router.push(`/${locale}/login`);
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) { fetchArticles(page, filters); fetchStatus(); fetchReports(); fetchOverallSentiment(); }
  }, [user, page, filterAnalyzed]);

  // ── Fetch unfiltered sentiment counts for the chart ───────────────────────
  const fetchOverallSentiment = async () => {
    try {
      const res = await fetch("/api/news?limit=500&analyzed=true");
      const data = await res.json();
      const counts = (data.articles || []).reduce((acc, a) => {
        const l = a.sentiment?.label;
        if (!l) return acc;
        acc[l] = (acc[l] || 0) + 1;
        return acc;
      }, {});
      setOverallSentiment(counts);
    } catch {}
  };

  // ── Updated fetchArticles — accepts filters ────────────────────────────────
  const fetchArticles = async (pageNum = page, activeFilters = filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 50, page: pageNum });
      if (filterAnalyzed !== "")        params.set("analyzed",  filterAnalyzed);
      if (activeFilters.keyword)        params.set("keyword",   activeFilters.keyword);
      if (activeFilters.dateFrom)       params.set("dateFrom",  activeFilters.dateFrom);
      if (activeFilters.dateTo)         params.set("dateTo",    activeFilters.dateTo);
      if (activeFilters.source)         params.set("crawler",   activeFilters.source);
      if (activeFilters.sentiment)      params.set("sentiment", activeFilters.sentiment);
      const res = await fetch(`/api/news?${params}`);
      const data = await res.json();
      setArticles(data.articles || []);
      setTotalPages(data.pages || 1);
    } catch {
      setArticles([]);
      setMsg("⚠️ Could not reach the server. Make sure the backend is running.");
    }
    setLoading(false);
  };

  // ── Filter handlers ────────────────────────────────────────────────────────
  const handleFilter = (newFilters) => {
    setFilters(newFilters);
    setPage(1);
    fetchArticles(1, newFilters);
  };

  const handleReset = () => {
    const empty = { keyword: "", dateFrom: "", dateTo: "" };
    setFilters(empty);
    setPage(1);
    fetchArticles(1, empty);
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/sentiment-status");
      const data = await res.json();
      setStatus(data);
    } catch {}
  };

  const fetchReports = async () => {
    try {
      const res = await fetch("/api/reports");
      const data = await res.json();
      setReports(data.reports || []);
    } catch {}
  };

  const triggerReport = async () => {
    setGenReport(true); setReportMsg("");
    try {
      const res = await fetch("/api/reports-generate", { method: "POST" });
      const data = await res.json();
      setReportMsg(data.message || "Report generated");
      fetchReports();
    } catch { setReportMsg("Failed to generate report"); }
    setGenReport(false);
  };

  const exportReportCSV = (r) => {
    const rows = [
      ["Field", "Value"],
      ["Type", r.type],
      ["Period From", new Date(r.period?.from).toLocaleDateString()],
      ["Period To", new Date(r.period?.to).toLocaleDateString()],
      ["Generated At", new Date(r.createdAt).toLocaleString()],
      ["Total Articles", r.stats?.total ?? 0],
      ["Positive", r.stats?.positive ?? 0],
      ["Negative", r.stats?.negative ?? 0],
      ["Neutral", r.stats?.neutral ?? 0],
      ["Narrative", `"${(r.narrative || "").replace(/"/g, '""')}"`],
      [],
      ["Top Articles", "Sentiment"],
      ...(r.topArticles || []).map(a => [`"${(a.title || "").replace(/"/g, '""')}"`, a.sentiment || ""]),
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${r.type}-${new Date(r.createdAt).toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportReportPDF = (r) => {
    const win = window.open("", "_blank");
    const from = new Date(r.period?.from).toLocaleDateString();
    const to   = new Date(r.period?.to).toLocaleDateString();
    const articles = (r.topArticles || []).map(a =>
      `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:12px">${a.title || ""}</td>
       <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:12px;color:${
         a.sentiment === "POSITIVE" ? "green" : a.sentiment === "NEGATIVE" ? "red" : "#b45"
       }">${a.sentiment || ""}</td></tr>`
    ).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Report</title>
      <style>body{font-family:sans-serif;padding:40px;color:#111}h1{font-size:22px;margin-bottom:4px}
      .sub{color:#888;font-size:13px;margin-bottom:24px}.stats{display:flex;gap:16px;margin-bottom:24px}
      .stat{background:#f5f5f5;border-radius:8px;padding:12px 20px;text-align:center}
      .stat-val{font-size:24px;font-weight:700}.stat-label{font-size:11px;color:#888}
      .narrative{background:#f9f9f9;border-left:3px solid #4f46e5;padding:12px 16px;font-size:13px;line-height:1.7;margin-bottom:24px}
      table{width:100%;border-collapse:collapse}th{text-align:left;font-size:11px;color:#888;padding:6px 8px;border-bottom:2px solid #eee}
      </style></head><body>
      <h1>Sentiment Report · ${r.type?.toUpperCase()}</h1>
      <p class="sub">${from} – ${to} · Generated ${new Date(r.createdAt).toLocaleString()}</p>
      <div class="stats">
        <div class="stat"><div class="stat-val">${r.stats?.total ?? 0}</div><div class="stat-label">Total</div></div>
        <div class="stat"><div class="stat-val" style="color:green">${r.stats?.positive ?? 0}</div><div class="stat-label">Positive</div></div>
        <div class="stat"><div class="stat-val" style="color:red">${r.stats?.negative ?? 0}</div><div class="stat-label">Negative</div></div>
        <div class="stat"><div class="stat-val" style="color:#b45">${r.stats?.neutral ?? 0}</div><div class="stat-label">Neutral</div></div>
      </div>
      ${r.narrative ? `<div class="narrative">${r.narrative}</div>` : ""}
      ${articles ? `<table><thead><tr><th>Article</th><th>Sentiment</th></tr></thead><tbody>${articles}</tbody></table>` : ""}
      <script>window.onload=()=>window.print()</script>
      </body></html>`);
    win.document.close();
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
      fetchOverallSentiment();
    } catch { setMsg("Failed to run batch"); }
    setProcessing(false);
  };

  const keywords = countKeywords(articles);
  const maxCount = keywords[0]?.[1] || 1;

  // ── Semantic search handler ───────────────────────────────────────────────
  const handleSemanticSearch = async () => {
    if (!semanticQuery.trim()) return;
    setSemanticLoading(true);
    setSemanticResults(null);
    try {
      const res = await fetch("/api/semantic-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: semanticQuery, limit: 20 }),
      });
      const data = await res.json();
      setSemanticResults(data.articles || []);
    } catch { setSemanticResults([]); }
    setSemanticLoading(false);
  };

  // ── Similar articles handler ──────────────────────────────────────────────
  const handleShowSimilar = async (article) => {
    if (similarFor?._id === article._id) { setSimilarFor(null); return; }
    setSimilarFor(article);
    setSimilarLoading(true);
    setSimilarArticles([]);
    try {
      const res = await fetch(`/api/similar/${article._id}`);
      const data = await res.json();
      setSimilarArticles(data.articles || []);
    } catch {}
    setSimilarLoading(false);
  };

  const sentimentCounts = articles.reduce((acc, a) => {
    const l = a.sentiment?.label || "UNKNOWN";
    acc[l] = (acc[l] || 0) + 1;
    return acc;
  }, {});

  if (authLoading || !user) return null;

  return (
    <div className="flex min-h-screen pt-16">

      {/* Filter Sidebar */}
      <FilterSidebar onFilter={handleFilter} onReset={handleReset} />

      {/* Main content */}
      <div className="flex-1 overflow-x-hidden">
        <div className="max-w-5xl mx-auto flex flex-col gap-6 px-6 pt-12 pb-20">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">{t("title")}</h1>
              <p className="text-gray-400 text-sm mt-1">{t("subtitle")}</p>
            </div>
            <button
              onClick={runBatch}
              disabled={processing}
              className="px-4 py-2 bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/30 rounded-xl text-sm font-medium transition disabled:opacity-40"
            >
              {processing ? t("processing") : t("runBatch")}
            </button>
          </div>

          {msg && <p className="text-xs text-green-400 text-center">{msg}</p>}

          {/* Onboarding — only shown when no articles exist yet */}
          {!loading && status?.total === 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-blue-500/20 bg-blue-500/5 px-6 py-5 flex flex-col gap-3"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">👋</span>
                <p className="text-sm font-medium text-white">{t("welcome")}</p>
              </div>
              <div className="flex flex-col gap-2 text-xs text-gray-400">
                <p>{t("step1")}</p>
                <p>{t("step2")}</p>
                <p>{t("step3")}</p>
                <p>{t("step4")}</p>
              </div>
              <p className="text-[10px] text-blue-400/60">{t("welcomeNote")}</p>
            </motion.div>
          )}

          {/* Active filter notice */}
          {(filters.keyword || filters.dateFrom || filters.dateTo || filters.source || filters.sentiment) && (
            <div className="text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-2">
              {t("filteredResults")}
              {filters.keyword   && <> · keyword: <strong>"{filters.keyword}"</strong></>}
              {filters.source    && <> · source: <strong>{{ googleNews: "Google News", ptt: "PTT", youtube: "YouTube" }[filters.source] || filters.source}</strong></>}
              {filters.dateFrom  && <> · from: <strong>{filters.dateFrom}</strong></>}
              {filters.dateTo    && <> · to: <strong>{filters.dateTo}</strong></>}
            </div>
          )}

          {/* Status cards */}
          {status && (
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: t("totalArticles"), value: status.total },
                { label: t("analyzed"),      value: status.analyzed,   color: "text-green-400" },
                { label: t("pending"),       value: status.unanalyzed, color: "text-yellow-400" },
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
              <p className="text-xs text-gray-500 uppercase tracking-wider">{t("keywordFreq")}</p>
              {loading ? (
                <p className="text-gray-600 text-sm text-center py-8">{t("loading")}</p>
              ) : keywords.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-8">{t("noKeywords")}</p>
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
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 uppercase tracking-wider">{t("sentimentBreakdown")}</p>
                <span className="text-[10px] text-gray-600 italic">{t("overallCorpus")}</span>
              </div>
              {loading ? (
                <p className="text-gray-600 text-sm text-center py-8">{t("loading")}</p>
              ) : (
                <div className="flex flex-col gap-3 mt-2">
                  {Object.entries(overallSentiment).map(([label, count], i) => {
                    const total = Object.values(overallSentiment).reduce((a, b) => a + b, 0);
                    const pct = Math.round((count / total) * 100);
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
                  {Object.keys(overallSentiment).length === 0 && (
                    <p className="text-gray-600 text-sm text-center py-8">{t("noAnalyzed")}</p>
                  )}
                </div>
              )}
            </ArticleCard>
          </div>

          {/* Keyword Watchlist */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
            <KeywordWatchlistPanel />
          </div>

          {/* Sentiment Heatmap */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
            <KeywordHeatmap />
          </div>

          {/* Topic Modeling */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
            <TopicModelingPanel />
          </div>

          {/* Stance Analysis */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
            <StancePanel />
          </div>

          {/* Trend Prediction */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
            <TrendPredictionPanel />
          </div>

          {/* Reports */}
          <ArticleCard className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <p className="text-xs text-gray-500 uppercase tracking-wider">{t("weeklyReports")}</p>
                <button
                  onClick={() => setShowReports(v => !v)}
                  className="text-[10px] text-gray-600 hover:text-gray-400 border border-white/10 hover:border-white/20 rounded-lg px-2 py-0.5 transition"
                >
                  {showReports ? t("hide") : t("show")}
                </button>
              </div>
              <button
                onClick={triggerReport}
                disabled={genReport}
                className="px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/30 rounded-xl text-xs font-medium transition disabled:opacity-40"
              >
                {genReport ? t("generating") : t("generateNow")}
              </button>
            </div>

            {reportMsg && <p className="text-xs text-green-400">{reportMsg}</p>}

            {showReports && (
              <>
                {reports.length === 0 ? (
                  <p className="text-gray-600 text-sm text-center py-6">{t("noReports")}</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {reports.map((r, i) => (
                      <motion.div
                        key={r._id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col gap-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] px-2 py-0.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 font-medium uppercase">
                              {r.type}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(r.period?.from).toLocaleDateString()} – {new Date(r.period?.to).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-600">{new Date(r.createdAt).toLocaleString()}</span>
                            <button
                              onClick={() => exportReportCSV(r)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600/20 hover:bg-green-600/35 border border-green-500/30 text-green-400 text-xs font-medium transition"
                            >
                              ⬇ CSV
                            </button>
                            <button
                              onClick={() => exportReportPDF(r)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/35 border border-indigo-500/30 text-indigo-400 text-xs font-medium transition"
                            >
                              🖨 PDF
                            </button>
                          </div>
                        </div>

                        {r.stats && (
                          <div className="grid grid-cols-4 gap-2">
                            {[
                      { label: t("totalArticles"), value: r.stats.total,    color: "text-white" },
                      { label: t("positive"),      value: r.stats.positive, color: "text-green-400" },
                      { label: t("negative"),      value: r.stats.negative, color: "text-red-400" },
                      { label: t("neutral"),       value: r.stats.neutral,  color: "text-yellow-400" },
                            ].map((s) => (
                              <div key={s.label} className="text-center p-2 rounded-lg bg-white/5">
                                <p className={`text-lg font-bold ${s.color}`}>{s.value ?? 0}</p>
                                <p className="text-[10px] text-gray-500">{s.label}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {r.narrative && (
                          <p className="text-xs text-gray-400 leading-relaxed border-l-2 border-indigo-500/40 pl-3">
                            {r.narrative}
                          </p>
                        )}

                        {r.topArticles?.length > 0 && (
                          <div className="flex flex-col gap-1">
                            <p className="text-[10px] text-gray-600 uppercase tracking-wider">{t("topArticles")}</p>
                            {r.topArticles.map((a, j) => (
                              <div key={j} className="flex items-center justify-between gap-2 text-xs">
                                <a href={a.url} target="_blank" rel="noopener noreferrer"
                                  className="text-gray-400 hover:text-white truncate transition">{a.title}</a>
                                <SentimentBadge label={a.sentiment} />
                              </div>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </>
            )}
          </ArticleCard>

          {/* Article list */}
          <ArticleCard className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500 uppercase tracking-wider">{t("articles")}</p>
              <div className="flex items-center gap-2">
                {/* Search mode toggle */}
                <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-0.5">
                  <button
                    onClick={() => { setSearchMode("keyword"); setSemanticResults(null); }}
                    className={`text-[10px] px-2.5 py-1 rounded-md transition font-medium ${searchMode === "keyword" ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"}`}
                  >
                    {t("keyword")}
                  </button>
                  <button
                    onClick={() => setSearchMode("semantic")}
                    className={`text-[10px] px-2.5 py-1 rounded-md transition font-medium ${searchMode === "semantic" ? "bg-violet-500/30 text-violet-300" : "text-gray-500 hover:text-gray-300"}`}
                  >
                    {t("semantic")}
                  </button>
                </div>
                {searchMode === "keyword" && (
                  <select
                    value={filterAnalyzed}
                    onChange={e => { setFilterAnalyzed(e.target.value); setPage(1); }}
                    className="text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-gray-300 outline-none"
                  >
                    <option value="">{t("all")}</option>
                    <option value="true">{t("analyzedFilter")}</option>
                    <option value="false">{t("pendingFilter")}</option>
                  </select>
                )}
              </div>
            </div>

            {/* Semantic search input */}
            {searchMode === "semantic" && (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={t("semanticPlaceholder")}
                  value={semanticQuery}
                  onChange={e => setSemanticQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSemanticSearch()}
                  className="flex-1 text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-gray-200 placeholder-gray-600 outline-none focus:border-violet-500/40 transition"
                />
                <button
                  onClick={handleSemanticSearch}
                  disabled={semanticLoading || !semanticQuery.trim()}
                  className="px-3 py-2 bg-violet-600/30 hover:bg-violet-600/50 border border-violet-500/30 rounded-lg text-xs font-medium transition disabled:opacity-40"
                >
                  {semanticLoading ? t("searching") : t("search")}
                </button>
              </div>
            )}

            {/* Semantic results notice */}
            {searchMode === "semantic" && semanticResults !== null && (
              <p className="text-[10px] text-violet-400">
                {semanticResults.length > 0
                  ? `${semanticResults.length} ${t("semanticFound")}`
                  : t("semanticEmpty")}
              </p>
            )}

            {/* Article rows */}
            {loading && searchMode === "keyword" ? (
              <p className="text-gray-600 text-sm text-center py-8">{t("loading")}</p>
            ) : (semanticResults ?? articles).length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-8">
                {searchMode === "semantic" && semanticResults === null ? t("semanticHint") : t("noArticles")}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {(semanticResults ?? articles).map((a, i) => (
                  <motion.div
                    key={a._id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="flex flex-col rounded-xl hover:bg-white/5 transition"
                  >
                    <div className="flex items-start justify-between gap-3 px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <a href={a.url} target="_blank" rel="noopener noreferrer"
                          className="text-sm text-gray-200 hover:text-white transition truncate block">
                          {a.title}
                        </a>
                        <div className="flex gap-2 mt-1 flex-wrap items-center">
                          <span className="text-[10px] text-gray-600">{a.source}</span>
                          {a.keywords?.slice(0, 3).map(k => (
                            <span key={k} className="text-[10px] px-1.5 py-0.5 bg-white/5 rounded text-gray-500">{k}</span>
                          ))}
                          {a.score !== undefined && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-violet-500/15 border border-violet-500/20 rounded text-violet-400">
                              {Math.round(a.score * 100)}% match
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {a.analyzed ? <SentimentBadge label={a.sentiment?.label} /> : (
                          <span className="text-[10px] text-gray-600 border border-white/10 rounded-full px-2 py-0.5">{t("pending_badge")}</span>
                        )}
                        {a.analyzed && (
                          <button
                            onClick={() => handleShowSimilar(a)}
                            title="Find similar articles"
                            className={`text-[10px] px-2 py-0.5 rounded-lg border transition ${
                              similarFor?._id === a._id
                                ? "border-violet-500/40 bg-violet-500/20 text-violet-300"
                                : "border-white/10 text-gray-600 hover:text-gray-300 hover:border-white/20"
                            }`}
                          >
                            {t("similar")}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Similar articles drawer */}
                    {similarFor?._id === a._id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mx-3 mb-2 px-3 py-2 rounded-lg bg-violet-500/5 border border-violet-500/15"
                      >
                        <p className="text-[10px] text-violet-400 mb-2 uppercase tracking-wider">{t("similarArticles")}</p>
                        {similarLoading ? (
                          <p className="text-[10px] text-gray-600 py-2">{t("findingSimilar")}</p>
                        ) : similarArticles.length === 0 ? (
                          <p className="text-[10px] text-gray-600 py-2">{t("noSimilar")}</p>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {similarArticles.map(s => (
                              <div key={s._id} className="flex items-center justify-between gap-2">
                                <a href={s.url} target="_blank" rel="noopener noreferrer"
                                  className="text-[11px] text-gray-400 hover:text-white transition truncate flex-1">
                                  {s.title}
                                </a>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <span className="text-[9px] text-violet-400">{Math.round(s.score * 100)}%</span>
                                  <SentimentBadge label={s.sentiment?.label} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}

            {/* Pagination — only in keyword mode */}
            {searchMode === "keyword" && totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1 text-xs bg-white/5 rounded-lg disabled:opacity-30 hover:bg-white/10 transition">{t("prev")}</button>
                <span className="text-xs text-gray-500 px-2 py-1">{page} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-3 py-1 text-xs bg-white/5 rounded-lg disabled:opacity-30 hover:bg-white/10 transition">{t("next")}</button>
              </div>
            )}
          </ArticleCard>

        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ErrorBoundary>
      <DashboardPageInner />
    </ErrorBoundary>
  );
}