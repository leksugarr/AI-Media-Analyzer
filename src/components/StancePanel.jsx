"use client";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";

const LABEL_STYLE = {
  "支持": "text-green-400 border-green-500/30 bg-green-500/10",
  "反對": "text-red-400 border-red-500/30 bg-red-500/10",
  "中立": "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
};

const BAR_COLOR = {
  "支持": "bg-green-500/50",
  "反對": "bg-red-500/50",
  "中立": "bg-yellow-500/50",
};

export default function StancePanel() {
  const t = useTranslations("stance");
  const [data, setData]           = useState(null);
  const [running, setRunning]     = useState(false);
  const [msg, setMsg]             = useState("");
  const [keywords, setKeywords]   = useState([]);
  const [keyword, setKeyword]     = useState("");
  const [kwData, setKwData]       = useState(null);
  const [kwLoading, setKwLoading] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/stance");
      setData(await res.json());
    } catch {}
  };

  const fetchKeywords = async () => {
    try {
      const res = await fetch("/api/watchlist");
      const json = await res.json();
      setKeywords((json.keywords || []).filter(k => k.active).map(k => k.keyword));
    } catch {}
  };

  const fetchByKeyword = async (kw) => {
    if (!kw) { setKwData(null); return; }
    setKwLoading(true);
    try {
      const res = await fetch(`/api/stance/by-keyword?keyword=${encodeURIComponent(kw)}`);
      setKwData(await res.json());
    } catch {}
    setKwLoading(false);
  };

  useEffect(() => { fetchStatus(); fetchKeywords(); }, []);

  const handleRun = async () => {
    setRunning(true); setMsg("");
    try {
      const res  = await fetch("/api/stance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 50 }) });
      const json = await res.json();
      setMsg(json.message || "Started");
      setTimeout(fetchStatus, 3000);
    } catch { setMsg("Failed"); }
    setRunning(false);
  };

  const overallTotal = data?.distribution?.reduce((s, d) => s + d.count, 0) || 0;
  const activeData   = keyword && kwData ? kwData.distribution : data?.distribution;
  const activeTotal  = keyword && kwData ? kwData.total : overallTotal;

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider">{t("title")}</p>
          {data && (
            <p className="text-[10px] text-gray-600 mt-0.5">
              {data.scored} / {data.total} {t("scored")} · {data.unscored} {t("pending")}
            </p>
          )}
        </div>
        <button
          onClick={handleRun}
          disabled={running}
          className="text-[10px] px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 rounded-lg transition disabled:opacity-40"
        >
          {running ? t("running") : t("run")}
        </button>
      </div>

      {msg && <p className="text-[10px] text-green-400">{msg}</p>}

      {/* Keyword filter */}
      {keywords.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 shrink-0">Filter by keyword:</span>
          <select
            value={keyword}
            onChange={e => { setKeyword(e.target.value); fetchByKeyword(e.target.value); }}
            className="text-[11px] bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-gray-300 outline-none flex-1 min-w-0"
          >
            <option value="">— Overall —</option>
            {keywords.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
      )}

      {/* Loading state for keyword fetch */}
      {kwLoading && (
        <p className="text-[10px] text-gray-500 text-center py-2">Loading…</p>
      )}

      {/* No data for selected keyword */}
      {keyword && kwData && kwData.total === 0 && !kwLoading && (
        <p className="text-xs text-gray-600 text-center py-4">
          No stance data for &quot;{keyword}&quot; yet — run the pipeline to score articles.
        </p>
      )}

      {/* Distribution bars */}
      {!kwLoading && activeData?.length > 0 && (
        <div className="flex flex-col gap-2">
          {activeData.map(({ label, count }) => {
            const pct = activeTotal > 0 ? Math.round((count / activeTotal) * 100) : 0;
            return (
              <div key={label} className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${LABEL_STYLE[label] || "text-gray-400 border-white/10"}`}>
                    {label}
                  </span>
                  <span className="text-[10px] text-gray-500">{count} articles ({pct}%)</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${BAR_COLOR[label] || "bg-gray-500/50"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
          {keyword && kwData && (
            <p className="text-[10px] text-gray-600 mt-1">
              {kwData.total} articles matched keyword &quot;{keyword}&quot;
            </p>
          )}
        </div>
      )}

      {/* Empty state — no data at all */}
      {!kwLoading && !activeData?.length && (
        <p className="text-xs text-gray-600 text-center py-6">
          {data ? t("noData") : t("loading")}
        </p>
      )}

    </div>
  );
}