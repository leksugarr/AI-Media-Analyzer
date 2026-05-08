"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

// ── Color mapping: sentiment label + intensity → Tailwind bg class ────────────
function cellColor(cell) {
  if (!cell) return "bg-white/5";
  const { label, avg } = cell;
  const intensity = Math.min(avg, 1);
  if (label === "POSITIVE") {
    if (intensity >= 0.75) return "bg-green-500/70";
    if (intensity >= 0.5)  return "bg-green-500/45";
    return "bg-green-500/20";
  }
  if (label === "NEGATIVE") {
    if (intensity >= 0.75) return "bg-red-500/70";
    if (intensity >= 0.5)  return "bg-red-500/45";
    return "bg-red-500/20";
  }
  // NEUTRAL
  if (intensity >= 0.6) return "bg-yellow-500/40";
  return "bg-yellow-500/15";
}

function cellText(cell) {
  if (!cell) return "";
  return `${cell.label[0]}${cell.count}`;  // e.g. "P4", "N2"
}

// ── Shorten ISO week label for display ────────────────────────────────────────
function shortWeek(w) {
  // "2025-W03" → "W03"
  return w.split("-")[1];
}

export default function KeywordHeatmap() {
  const t = useTranslations("heatmap");
  const tFilter = useTranslations("filter");

  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState(null); // { keyword, week, cell }

  useEffect(() => {
    fetch("/api/heatmap")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <p className="text-xs text-gray-600 animate-pulse">{t("loading")}</p>
      </div>
    );
  }

  if (!data || !data.keywords?.length) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 text-xs">{t("noData")}</p>
        <p className="text-gray-700 text-[10px] mt-1">{t("noDataHint")}</p>
      </div>
    );
  }

  const { weeks, keywords, cells } = data;

  return (
    <div className="flex flex-col gap-3 relative">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider">{t("title")}</p>
          <p className="text-[10px] text-gray-600 mt-0.5">{t("subtitle")}</p>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-3">
          {[
            { color: "bg-green-500/60", label: tFilter("positive") },
            { color: "bg-red-500/60",   label: tFilter("negative") },
            { color: "bg-yellow-500/40",label: tFilter("neutral")  },
            { color: "bg-white/5",      label: t("noData")         },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-sm ${l.color}`} />
              <span className="text-[10px] text-gray-500">{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: `${keywords.length * 44 + 100}px` }}>
          <thead>
            <tr>
              {/* Empty corner */}
              <th className="w-24" />
              {keywords.map((kw) => (
                <th
                  key={kw}
                  className="text-[10px] text-gray-500 font-normal pb-2 px-0.5 text-center"
                  style={{ maxWidth: 40 }}
                >
                  <span className="block truncate max-w-[38px]" title={kw}>{kw}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, wi) => (
              <tr key={week}>
                {/* Week label */}
                <td className="text-[10px] text-gray-600 pr-2 py-0.5 text-right whitespace-nowrap">
                  {shortWeek(week)}
                </td>
                {keywords.map((kw) => {
                  const key  = `${kw}::${week}`;
                  const cell = cells[key] || null;
                  return (
                    <td key={kw} className="px-0.5 py-0.5">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: (wi * keywords.length) * 0.002, duration: 0.2 }}
                        onMouseEnter={() => setTooltip({ keyword: kw, week, cell })}
                        onMouseLeave={() => setTooltip(null)}
                        className={`
                          w-9 h-7 rounded flex items-center justify-center
                          text-[8px] font-medium cursor-default transition
                          ${cellColor(cell)}
                          ${cell ? "text-white/70" : "text-transparent"}
                        `}
                      >
                        {cellText(cell)}
                      </motion.div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10
          bg-gray-900 border border-white/10 rounded-xl px-3 py-2 text-xs shadow-xl pointer-events-none">
          <p className="text-white font-medium">{tooltip.keyword}</p>
          <p className="text-gray-400">{tooltip.week}</p>
          {tooltip.cell ? (
            <>
              <p className="text-gray-300 mt-1">
                {t("tooltipSentiment")}:{" "}
                <span className={
                  tooltip.cell.label === "POSITIVE" ? "text-green-400" :
                  tooltip.cell.label === "NEGATIVE" ? "text-red-400" : "text-yellow-400"
                }>
                  {tooltip.cell.label === "POSITIVE" ? tFilter("positive")
                    : tooltip.cell.label === "NEGATIVE" ? tFilter("negative")
                    : tFilter("neutral")}
                </span>
              </p>
              <p className="text-gray-400">{t("tooltipScore")}: {tooltip.cell.avg}</p>
              <p className="text-gray-400">{t("tooltipArticles")}: {tooltip.cell.count}</p>
            </>
          ) : (
            <p className="text-gray-600 mt-1">{t("tooltipNoData")}</p>
          )}
        </div>
      )}

    </div>
  );
}