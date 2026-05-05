"use client";
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";

const RISK_COLOR = {
  low:    "text-green-400 border-green-500/30 bg-green-500/10",
  medium: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
  high:   "text-red-400 border-red-500/30 bg-red-500/10",
};

const DIR_ICON = { rising: "↗", stable: "→", declining: "↘" };
const DIR_COLOR = { rising: "text-green-400", stable: "text-yellow-400", declining: "text-red-400" };
const SENT_COLOR = { POSITIVE: "bg-green-500/50", NEGATIVE: "bg-red-500/50", NEUTRAL: "bg-yellow-500/50" };

// ── Tiny inline bar chart ──────────────────────────────────────────────────────
function MiniBarChart({ series }) {
  if (!series?.length) return null;
  const max = Math.max(...series.map(s => s.count), 1);
  return (
    <div className="flex items-end gap-[2px] h-16 w-full">
      {series.map((s, i) => {
        const pct = Math.round((s.count / max) * 100);
        const color =
          s.positive > s.negative ? "bg-green-500/50" :
          s.negative > s.positive ? "bg-red-500/50"   : "bg-yellow-500/50";
        return (
          <div key={i} className="flex-1 flex flex-col justify-end group relative">
            <div
              className={`rounded-t-sm ${color} transition-all`}
              style={{ height: `${Math.max(pct, 4)}%` }}
            />
            {/* Tooltip */}
            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
              <div className="bg-gray-900 border border-white/10 rounded-lg px-2 py-1 text-[9px] text-gray-300 whitespace-nowrap shadow-xl">
                <div>{s.date}</div>
                <div className="text-white font-medium">{s.count} articles</div>
                <div className="text-green-400">+{s.positive}</div>
                <div className="text-red-400">-{s.negative}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Forecast point row ─────────────────────────────────────────────────────────
function ForecastRow({ point, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className="flex items-center justify-between gap-3 py-1.5 border-b border-white/5 last:border-0"
    >
      <span className="text-[10px] text-gray-500 w-20">{point.date}</span>
      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-2 rounded-full ${SENT_COLOR[point.sentiment] || "bg-gray-500/40"} transition-all`}
          style={{ width: `${Math.min(100, (point.estimatedCount / 20) * 100)}%` }}
        />
      </div>
      <span className="text-[10px] text-gray-400 w-8 text-right">{point.estimatedCount}</span>
      <span className={`text-[9px] px-1.5 py-0.5 rounded border ${
        point.sentiment === "POSITIVE" ? "text-green-400 border-green-500/30 bg-green-500/10" :
        point.sentiment === "NEGATIVE" ? "text-red-400 border-red-500/30 bg-red-500/10" :
        "text-yellow-400 border-yellow-500/30 bg-yellow-500/10"
      }`}>
        {point.sentiment}
      </span>
    </motion.div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function TrendPredictionPanel() {
  const [keyword, setKeyword]   = useState("");
  const [days,    setDays]      = useState(30);
  const [data,    setData]      = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState("");
  const [input,   setInput]     = useState("");

  const fetchTrends = useCallback(async (kw = keyword, d = days) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ days: d });
      if (kw) params.set("keyword", kw);
      const res  = await fetch(`/api/trends?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setData(json);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [keyword, days]);

  // Load on mount with defaults
  useEffect(() => { fetchTrends("", 30); }, []);

  const handleSearch = () => {
    setKeyword(input);
    fetchTrends(input, days);
  };

  const { series = [], forecast } = data || {};

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider">Trend Prediction</p>
          {forecast && (
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-sm font-bold ${DIR_COLOR[forecast.direction] || "text-gray-400"}`}>
                {DIR_ICON[forecast.direction]} {forecast.direction}
              </span>
              {forecast.riskSignal && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-medium ${RISK_COLOR[forecast.riskSignal] || ""}`}>
                  {forecast.riskSignal} risk
                </span>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-0.5">
            {[14, 30, 60, 90].map(d => (
              <button
                key={d}
                onClick={() => { setDays(d); fetchTrends(keyword, d); }}
                className={`text-[10px] px-2 py-0.5 rounded-md transition ${days === d ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"}`}
              >
                {d}d
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            <input
              type="text"
              placeholder="Filter keyword..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              className="text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-gray-300 placeholder-gray-600 outline-none focus:border-blue-500/40 transition w-36"
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className="text-[10px] px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 rounded-lg transition disabled:opacity-40"
            >
              {loading ? "…" : "Go"}
            </button>
            {keyword && (
              <button
                onClick={() => { setInput(""); setKeyword(""); fetchTrends("", days); }}
                className="text-[10px] px-2 py-1 text-gray-500 hover:text-gray-300 border border-white/10 rounded-lg transition"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {keyword && (
        <p className="text-[10px] text-blue-400">
          Showing trends for: <strong>"{keyword}"</strong>
        </p>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      {loading && (
        <div className="flex items-center justify-center py-10 gap-2">
          <div className="w-4 h-4 border-2 border-blue-500/40 border-t-blue-400 rounded-full animate-spin" />
          <span className="text-xs text-gray-500">Analyzing trends...</span>
        </div>
      )}

      {!loading && data && (
        <>
          {/* Historical bar chart */}
          <div>
            <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">
              Daily article volume — last {days} days ({series.length} data points)
            </p>
            {series.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-6">No articles found for this period/keyword</p>
            ) : (
              <MiniBarChart series={series} />
            )}
          </div>

          {forecast && (
            <>
              {/* AI analysis */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Trend Analysis</p>
                  <p className="text-xs text-gray-300 leading-relaxed">{forecast.trend}</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
                  <p className="text-[10px] text-blue-400 uppercase tracking-wider mb-1.5">7-Day Forecast</p>
                  <p className="text-xs text-gray-300 leading-relaxed">{forecast.forecast}</p>
                </div>
              </div>

              {/* Forecast points */}
              {forecast.forecastPoints?.length > 0 && (
                <div>
                  <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Projected next 7 days</p>
                  <div className="rounded-xl bg-white/3 border border-white/5 px-3 py-1">
                    {forecast.forecastPoints.map((pt, i) => (
                      <ForecastRow key={i} point={pt} index={i} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {!forecast && series.length > 0 && (
            <p className="text-xs text-gray-600 text-center py-4">AI analysis unavailable — check Groq API</p>
          )}
        </>
      )}
    </div>
  );
}