"use client";
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useTranslations, useLocale } from "next-intl";

const RISK_COLOR = {
  low:    "text-green-400 border-green-500/30 bg-green-500/10",
  medium: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
  high:   "text-red-400 border-red-500/30 bg-red-500/10",
};

const DIR_ICON  = { rising: "↗", stable: "→", declining: "↘" };
const DIR_COLOR = { rising: "text-green-400", stable: "text-yellow-400", declining: "text-red-400" };

// ── SVG Line Chart (positive vs negative over time) ───────────────────────────
function SentimentLineChart({ series, labelPositive, labelNegative }) {
  if (!series?.length) return null;

  const W = 600, H = 110, PAD = { top: 10, right: 10, bottom: 24, left: 28 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const maxVal = Math.max(...series.flatMap(s => [s.positive, s.negative]), 1);
  const xStep  = innerW / Math.max(series.length - 1, 1);

  const toX = i => PAD.left + i * xStep;
  const toY = v => PAD.top + innerH - (v / maxVal) * innerH;

  const polyline = (key, color, fill) => {
    const pts = series.map((s, i) => `${toX(i)},${toY(s[key])}`).join(" ");
    const areaClose = `${toX(series.length - 1)},${PAD.top + innerH} ${toX(0)},${PAD.top + innerH}`;
    return (
      <g key={key}>
        <polygon points={`${pts} ${areaClose}`} fill={fill} />
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
        {series.map((s, i) => (
          <circle key={i} cx={toX(i)} cy={toY(s[key])} r="2.5" fill={color} />
        ))}
      </g>
    );
  };

  const labelIdxs = [0, Math.floor(series.length / 2), series.length - 1].filter(
    (v, i, a) => a.indexOf(v) === i && v < series.length
  );

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 280 }}>
        {[0, 0.5, 1].map(f => (
          <line
            key={f}
            x1={PAD.left} y1={PAD.top + innerH * (1 - f)}
            x2={PAD.left + innerW} y2={PAD.top + innerH * (1 - f)}
            stroke="#ffffff10" strokeWidth="1"
          />
        ))}
        {polyline("positive", "#4ade80", "#4ade8015")}
        {polyline("negative", "#f87171", "#f8717115")}
        {labelIdxs.map(i => (
          <text key={i} x={toX(i)} y={H - 4} textAnchor="middle" fontSize="8" fill="#4a5a7a">
            {series[i].date?.slice(5)}
          </text>
        ))}
        {[0, maxVal].map((v, i) => (
          <text
            key={i}
            x={PAD.left - 4}
            y={i === 0 ? PAD.top + innerH : PAD.top + 6}
            textAnchor="end" fontSize="8" fill="#4a5a7a"
          >
            {v}
          </text>
        ))}
      </svg>
      <div className="flex items-center gap-4 mt-1 px-1">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-green-400 rounded-full inline-block" />
          <span className="text-[10px] text-gray-500">{labelPositive}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-red-400 rounded-full inline-block" />
          <span className="text-[10px] text-gray-500">{labelNegative}</span>
        </div>
      </div>
    </div>
  );
}

// ── 7-day Forecast Cards ───────────────────────────────────────────────────────
function ForecastCards({ points, tFilter }) {
  if (!points?.length) return null;
  const maxCount = Math.max(...points.map(p => p.estimatedCount), 1);

  return (
    <div className="grid grid-cols-7 gap-1.5">
      {points.map((pt, i) => {
        const isPos     = pt.sentiment === "POSITIVE";
        const isNeg     = pt.sentiment === "NEGATIVE";
        const barPct    = Math.round((pt.estimatedCount / maxCount) * 100);
        const sentColor = isPos ? "#4ade80" : isNeg ? "#f87171" : "#facc15";
        const sentBg    = isPos ? "bg-green-500/10 border-green-500/20"
                        : isNeg ? "bg-red-500/10 border-red-500/20"
                        : "bg-yellow-500/10 border-yellow-500/20";
        const sentLabel = isPos ? tFilter("positive") : isNeg ? tFilter("negative") : tFilter("neutral");

        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border ${sentBg}`}
          >
            <span className="text-[9px] text-gray-500 font-medium">{pt.date?.slice(5)}</span>
            <div className="w-full flex flex-col items-center gap-1">
              <div className="w-full h-12 bg-white/5 rounded-lg flex flex-col justify-end overflow-hidden">
                <div
                  className="w-full rounded-lg transition-all"
                  style={{ height: `${Math.max(barPct, 8)}%`, background: `${sentColor}60` }}
                />
              </div>
              <span className="text-[9px] font-bold" style={{ color: sentColor }}>
                {pt.estimatedCount}
              </span>
            </div>
            <span className="text-[8px] font-medium" style={{ color: sentColor }}>
              {sentLabel}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function TrendPredictionPanel() {
  const t       = useTranslations("trend");
  const tFilter = useTranslations("filter");
  const locale  = useLocale();

  const [keyword, setKeyword] = useState("");
  const [days,    setDays]    = useState(30);
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [input,   setInput]   = useState("");

  const fetchTrends = useCallback(async (kw = keyword, d = days) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ days: d, locale });
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
          <p className="text-xs text-gray-500 uppercase tracking-wider">{t("title")}</p>
          {forecast && (
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-sm font-bold ${DIR_COLOR[forecast.direction] || "text-gray-400"}`}>
                {DIR_ICON[forecast.direction]} {t(`dir_${forecast.direction}`)}
              </span>
              {forecast.riskSignal && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-medium ${RISK_COLOR[forecast.riskSignal] || ""}`}>
                  {t(`risk_${forecast.riskSignal}`)}
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
                className={`text-[10px] px-2 py-0.5 rounded-md transition ${
                  days === d ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {d}{t("dSuffix")}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            <input
              type="text"
              placeholder={t("filterPlaceholder")}
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
              {loading ? "…" : t("go")}
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
          {t("showingFor")} <strong>"{keyword}"</strong>
        </p>
      )}

      {error && (
        <p className="text-xs text-yellow-500/80 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
          ⚠️ {error.includes("429") ? t("tokenLimitError") : error}
        </p>
      )}

      {loading && (
        <div className="flex items-center justify-center py-10 gap-2">
          <div className="w-4 h-4 border-2 border-blue-500/40 border-t-blue-400 rounded-full animate-spin" />
          <span className="text-xs text-gray-500">{t("analyzing")}</span>
        </div>
      )}

      {!loading && data && (
        <>
          {/* Section 1 — Sentiment line chart */}
          <div className="rounded-xl bg-white/3 border border-white/5 p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">
              {t("sentimentOverTime", { days })}
            </p>
            {series.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-6">{t("noArticles")}</p>
            ) : (
              <SentimentLineChart series={series} labelPositive={tFilter("positive")} labelNegative={tFilter("negative")} />
            )}
          </div>

          {forecast && (
            <>
              {/* Section 2 — AI analysis */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">{t("trendAnalysis")}</p>
                  <p className="text-xs text-gray-300 leading-relaxed">{forecast.trend}</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
                  <p className="text-[10px] text-blue-400 uppercase tracking-wider mb-1.5">{t("forecastTitle")}</p>
                  <p className="text-xs text-gray-300 leading-relaxed">{forecast.forecast}</p>
                </div>
              </div>

              {/* Section 3 — 7-day forecast cards */}
              {forecast.forecastPoints?.length > 0 && (
                <div>
                  <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">{t("projected")}</p>
                  <ForecastCards points={forecast.forecastPoints} tFilter={tFilter} />
                </div>
              )}
            </>
          )}

          {!forecast && series.length > 0 && (
            <p className="text-xs text-gray-600 text-center py-4">{t("aiUnavailable")}</p>
          )}
        </>
      )}
    </div>
  );
}