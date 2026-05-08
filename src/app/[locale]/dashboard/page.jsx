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
  const [showAllReports, setShowAllReports] = useState(false);

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
    if (!authLoading && user) { fetchArticles(page, filters); fetchStatus(); fetchReports(); fetchOverallSentiment(); }
  }, [authLoading, user, page, filterAnalyzed]);

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
    const total = r.stats?.total || 1;
    const pos   = r.stats?.positive ?? 0;
    const neg   = r.stats?.negative ?? 0;
    const neu   = r.stats?.neutral  ?? 0;
    const pPos  = Math.round((pos / total) * 100);
    const pNeg  = Math.round((neg / total) * 100);
    const pNeu  = Math.max(0, 100 - pPos - pNeg);
    // 0–10 sentiment score
    const score = Math.round(((pos - neg) / total) * 5 + 5);
    const scoreColor = score >= 7 ? "#16a34a" : score <= 3 ? "#dc2626" : "#b45309";

    // SVG donut chart
    const cx = 80, cy = 80, r2 = 60, stroke = 36;
    const circ = 2 * Math.PI * r2;
    const posD  = (pPos / 100) * circ;
    const neuD  = (pNeu / 100) * circ;
    const negD  = (pNeg / 100) * circ;
    const posOff = 0;
    const neuOff = circ - posD;
    const negOff = circ - posD - neuD;
    const donut = `
      <svg width="160" height="160" viewBox="0 0 160 160">
        <circle cx="${cx}" cy="${cy}" r="${r2}" fill="none" stroke="#f3f4f6" stroke-width="${stroke}"/>
        <circle cx="${cx}" cy="${cy}" r="${r2}" fill="none" stroke="#16a34a" stroke-width="${stroke}"
          stroke-dasharray="${posD} ${circ - posD}" stroke-dashoffset="${circ - posOff}"
          transform="rotate(-90 ${cx} ${cy})"/>
        <circle cx="${cx}" cy="${cy}" r="${r2}" fill="none" stroke="#d97706" stroke-width="${stroke}"
          stroke-dasharray="${neuD} ${circ - neuD}" stroke-dashoffset="${circ - neuOff}"
          transform="rotate(-90 ${cx} ${cy})"/>
        <circle cx="${cx}" cy="${cy}" r="${r2}" fill="none" stroke="#dc2626" stroke-width="${stroke}"
          stroke-dasharray="${negD} ${circ - negD}" stroke-dashoffset="${circ - negOff}"
          transform="rotate(-90 ${cx} ${cy})"/>
        <text x="${cx}" y="${cy - 8}" text-anchor="middle" font-size="22" font-weight="700" fill="${scoreColor}">${score}</text>
        <text x="${cx}" y="${cy + 10}" text-anchor="middle" font-size="11" fill="#6b7280">/10</text>
        <text x="${cx}" y="${cy + 26}" text-anchor="middle" font-size="9" fill="#9ca3af">sentiment score</text>
      </svg>`;

    const articleRows = (r.topArticles || []).map((a, i) => {
      const sColor = a.sentiment === "POSITIVE" ? "#16a34a" : a.sentiment === "NEGATIVE" ? "#dc2626" : "#b45309";
      const sBg    = a.sentiment === "POSITIVE" ? "#f0fdf4" : a.sentiment === "NEGATIVE" ? "#fef2f2" : "#fffbeb";
      return `<tr style="background:${i % 2 === 0 ? "#fff" : "#f9fafb"}">
        <td style="padding:10px 12px;font-size:12px;color:#111;border-bottom:1px solid #f3f4f6;line-height:1.5">${a.title || "—"}</td>
        <td style="padding:10px 12px;font-size:11px;font-weight:600;color:${sColor};background:${sBg};border-bottom:1px solid #f3f4f6;white-space:nowrap;text-align:center;border-radius:4px">${a.sentiment || "—"}</td>
      </tr>`;
    }).join("");

    const typeLabel = r.type === "weekly" ? "Weekly Report" : r.type === "daily" ? "Daily Report" : "Manual Report";

    win.document.write(`<!DOCTYPE html><html><head><title>Sentiment Report</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;color:#111;padding:0}
      .page{max-width:800px;margin:0 auto;padding:48px 40px;background:#fff;min-height:100vh}
      .header{border-bottom:2px solid #f1f5f9;padding-bottom:20px;margin-bottom:28px}
      .report-type{display:inline-block;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#6366f1;background:#eef2ff;padding:3px 10px;border-radius:20px;margin-bottom:10px}
      h1{font-size:26px;font-weight:700;color:#0f172a;letter-spacing:-.02em;margin-bottom:6px}
      .meta{font-size:12px;color:#94a3b8}
      .body{display:flex;gap:32px;margin-bottom:32px;align-items:flex-start}
      .chart-col{flex-shrink:0}
      .legend{display:flex;flex-direction:column;gap:8px;margin-top:12px}
      .legend-item{display:flex;align-items:center;gap:8px;font-size:12px;color:#374151}
      .legend-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
      .stats-col{flex:1}
      .stat-cards{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}
      .stat-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px}
      .stat-val{font-size:28px;font-weight:700;letter-spacing:-.02em;line-height:1}
      .stat-label{font-size:11px;color:#94a3b8;margin-top:4px;text-transform:uppercase;letter-spacing:.05em}
      .score-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;display:flex;align-items:center;gap:12px}
      .score-val{font-size:32px;font-weight:700}
      .score-desc{font-size:12px;color:#64748b;line-height:1.5}
      .narrative{background:#f8fafc;border-left:3px solid #6366f1;border-radius:0 8px 8px 0;padding:16px 20px;font-size:13px;line-height:1.8;color:#374151;margin-bottom:32px}
      .section-title{font-size:13px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px}
      table{width:100%;border-collapse:collapse;border-radius:10px;overflow:hidden;border:1px solid #f1f5f9}
      th{text-align:left;font-size:11px;color:#94a3b8;font-weight:600;padding:10px 12px;background:#f8fafc;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #e2e8f0}
      .footer{margin-top:40px;padding-top:16px;border-top:1px solid #f1f5f9;font-size:11px;color:#cbd5e1;text-align:center}
      @media print{body{background:#fff}.page{padding:32px 28px;box-shadow:none}}
    </style></head><body>
    <div class="page">
      <div class="header">
        <div class="report-type">${typeLabel}</div>
        <h1>Sentiment Report</h1>
        <p class="meta">${from} – ${to} &nbsp;·&nbsp; Generated ${new Date(r.createdAt).toLocaleString()}</p>
      </div>

      <div class="body">
        <div class="chart-col">
          ${donut}
          <div class="legend">
            <div class="legend-item"><div class="legend-dot" style="background:#16a34a"></div> Positive &nbsp;<strong>${pPos}%</strong></div>
            <div class="legend-item"><div class="legend-dot" style="background:#d97706"></div> Neutral &nbsp;<strong>${pNeu}%</strong></div>
            <div class="legend-item"><div class="legend-dot" style="background:#dc2626"></div> Negative &nbsp;<strong>${pNeg}%</strong></div>
          </div>
        </div>
        <div class="stats-col">
          <div class="stat-cards">
            <div class="stat-card"><div class="stat-val" style="color:#0f172a">${total.toLocaleString()}</div><div class="stat-label">Total Articles</div></div>
            <div class="stat-card"><div class="stat-val" style="color:#16a34a">${pos}</div><div class="stat-label">Positive</div></div>
            <div class="stat-card"><div class="stat-val" style="color:#dc2626">${neg}</div><div class="stat-label">Negative</div></div>
            <div class="stat-card"><div class="stat-val" style="color:#b45309">${neu}</div><div class="stat-label">Neutral</div></div>
          </div>
          <div class="score-card">
            <div class="score-val" style="color:${scoreColor}">${score}/10</div>
            <div class="score-desc"><strong>Sentiment Score</strong><br>10 = very positive &nbsp;·&nbsp; 5 = neutral &nbsp;·&nbsp; 0 = very negative</div>
          </div>
        </div>
      </div>

      ${r.narrative ? `
      <p class="section-title">AI Analysis</p>
      <div class="narrative">${r.narrative}</div>` : ""}

      ${r.topArticles?.length ? `
      <p class="section-title">Top Articles</p>
      <table>
        <thead><tr><th>Article</th><th style="width:110px;text-align:center">Sentiment</th></tr></thead>
        <tbody>${articleRows}</tbody>
      </table>` : ""}

      <div class="footer">AI Opinion Analysis System &nbsp;·&nbsp; Generated ${new Date().toLocaleString()}</div>
    </div>
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
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: t("totalArticles"), value: status?.total,        color: "text-white" },
                { label: t("analyzed"),      value: status?.analyzed,     color: "text-green-400" },
                { label: t("pending"),       value: status?.unanalyzed,   color: "text-yellow-400" },
              ].map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                  <ArticleCard className="p-4 text-center">
                    <p className={`text-2xl font-bold ${s.color}`}>
                      {s.value ?? "—"}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                  </ArticleCard>
                </motion.div>
              ))}
            </div>
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
  ) : Object.keys(overallSentiment).length === 0 ? (
    <p className="text-gray-600 text-sm text-center py-8">{t("noAnalyzed")}</p>
  ) : (
    (() => {
      const total = Object.values(overallSentiment).reduce((a, b) => a + b, 0);
      const COLORS = { POSITIVE: "#4ade80", NEGATIVE: "#f87171", NEUTRAL: "#facc15" };
      const entries = Object.entries(overallSentiment);
      const radius = 54;
      const circumference = 2 * Math.PI * radius;
      let offset = 0;

      const slices = entries.map(([label, count]) => {
        const pct = count / total;
        const dash = pct * circumference;
        const slice = { label, count, pct, dash, offset, color: COLORS[label] || "#4a5a7a" };
        offset += dash;
        return slice;
      });

      return (
        <div className="flex items-center gap-6 mt-2">
          {/* Donut */}
          <div className="relative flex-shrink-0">
            <svg width="130" height="130" viewBox="0 0 130 130">
              <circle cx="65" cy="65" r={radius} fill="none" stroke="#1e2130" strokeWidth="18" />
              {slices.map((s, i) => (
                <circle
                  key={s.label}
                  cx="65" cy="65" r={radius}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="18"
                  strokeDasharray={`${s.dash} ${circumference - s.dash}`}
                  strokeDashoffset={-s.offset + circumference * 0.25}
                  style={{ transition: "stroke-dasharray 0.6s ease" }}
                />
              ))}
            </svg>
            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold text-white">{total}</span>
              <span className="text-[10px] text-gray-500">{t("analyzed")}</span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-col gap-3 flex-1">
            {slices.map((s) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                  <span className="text-xs text-gray-300">
                    {s.label === "POSITIVE" ? t("positive") : s.label === "NEGATIVE" ? t("negative") : t("neutral")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{s.count}</span>
                  <span className="text-[10px] text-gray-600 w-8 text-right">{Math.round(s.pct * 100)}%</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      );
    })()
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
                    {(showAllReports ? reports : reports.slice(0, 2)).map((r, i) => (
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

                    {reports.length > 2 && (
                      <button
                        onClick={() => setShowAllReports(v => !v)}
                        className="text-xs text-gray-500 hover:text-gray-300 transition py-1 text-center"
                      >
                        {showAllReports ? "▲ View Less" : `▼ View More (${reports.length - 2} more)`}
                      </button>
                    )}
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