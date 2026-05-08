"use client";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations, useLocale } from "next-intl";

const LOCALES = [
  { value: "zh-TW", label: "Traditional Chinese (Taiwan)" },
  { value: "zh-CN", label: "Simplified Chinese (China)" },
  { value: "en-US", label: "English (US)" },
];

export default function KeywordWatchlistPanel() {
  const t = useTranslations("watchlist");
  const locale = useLocale();

  const [watchlist, setWatchlist]       = useState([]);
  const [suggestions, setSuggestions]   = useState([]);
  const [newKeyword, setNewKeyword]     = useState("");
  const [newLocale, setNewLocale]       = useState("zh-TW");
  const [adding, setAdding]             = useState(false);
  const [running, setRunning]           = useState(false);
  const [msg, setMsg]                   = useState("");
  const [tab, setTab]                   = useState("watchlist"); // "watchlist" | "suggestions"

  const flash = (text) => { setMsg(text); setTimeout(() => setMsg(""), 3000); };

  const fetchWatchlist = useCallback(async () => {
    try {
      const res = await fetch("/api/watchlist");
      const data = await res.json();
      setWatchlist(data.keywords || []);
    } catch {}
  }, []);

  const fetchSuggestions = useCallback(async () => {
    try {
      const res = await fetch("/api/suggestions?status=pending");
      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchWatchlist();
    fetchSuggestions();
  }, [fetchWatchlist, fetchSuggestions]);

  const handleAdd = async () => {
    if (!newKeyword.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: newKeyword.trim(), locale: newLocale, label: newKeyword.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { flash(data.error || t("addFailed")); }
      else { flash(`✅ "${newKeyword.trim()}" ${t("addedSuccess")}`); setNewKeyword(""); fetchWatchlist(); }
    } catch { flash(t("addFailed")); }
    setAdding(false);
  };

  const handleDelete = async (id, keyword) => {
    try {
      await fetch(`/api/watchlist/${id}`, { method: "DELETE" });
      flash(`🗑 "${keyword}" ${t("removedSuccess")}`);
      fetchWatchlist();
    } catch { flash(t("removeFailed")); }
  };

  const handleToggle = async (id) => {
    try {
      await fetch(`/api/watchlist/${id}/toggle`, { method: "PATCH" });
      fetchWatchlist();
    } catch { flash(t("toggleFailed")); }
  };

  const handleApprove = async (id, keyword) => {
    try {
      await fetch(`/api/suggestions/approve/${id}`, { method: "POST" });
      flash(`✅ "${keyword}" ${t("approvedSuccess")}`);
      fetchSuggestions();
      fetchWatchlist();
    } catch { flash(t("approveFailed")); }
  };

  const handleReject = async (id, keyword) => {
    try {
      await fetch(`/api/suggestions/reject/${id}`, { method: "POST" });
      flash(`❌ "${keyword}" ${t("rejectedSuccess")}`);
      fetchSuggestions();
    } catch { flash(t("rejectFailed")); }
  };

  const handleRunSuggestions = async () => {
    setRunning(true);
    flash(t("suggestRunning"));
    try {
      await fetch("/api/suggestions/run", { method: "POST" });
      flash(t("suggestDone"));
      fetchSuggestions();
    } catch { flash(t("suggestFailed")); }
    setRunning(false);
  };

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider">{t("title")}</p>
          <p className="text-[10px] text-gray-600 mt-0.5">{t("subtitle")}</p>
        </div>
        <button
          onClick={handleRunSuggestions}
          disabled={running}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600/30 hover:bg-violet-600/50 border border-violet-500/30 rounded-xl text-xs font-medium transition disabled:opacity-40"
        >
          {running ? t("running") : t("suggestBtn")}
        </button>
      </div>

      {msg && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
          {msg}
        </motion.p>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1">
        {[
          { key: "watchlist",   label: `${t("tabActive")} (${watchlist.length})` },
          { key: "suggestions", label: `${t("tabPending")} (${suggestions.length})` },
        ].map(tb => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`flex-1 text-xs py-1.5 rounded-lg transition font-medium ${
              tab === tb.key
                ? "bg-white/10 text-white"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {tb.label}
            {tb.key === "suggestions" && suggestions.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-violet-500/60 text-[9px] text-white">
                {suggestions.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Watchlist tab */}
      {tab === "watchlist" && (
        <div className="flex flex-col gap-3">

          {/* Add keyword form */}
          <div className="flex flex-col gap-1.5">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={t("addPlaceholder")}
                value={newKeyword}
                onChange={e => setNewKeyword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAdd()}
                className="flex-1 text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-gray-200 placeholder-gray-600 outline-none focus:border-white/20 transition"
              />
              <select
                value={newLocale}
                onChange={e => setNewLocale(e.target.value)}
                className="text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-gray-300 outline-none"
              >
                {LOCALES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
              <button
                onClick={handleAdd}
                disabled={adding || !newKeyword.trim()}
                className="px-3 py-2 bg-blue-600/40 hover:bg-blue-600/60 border border-blue-500/30 rounded-lg text-xs font-medium transition disabled:opacity-40"
              >
                {t("addBtn")}
              </button>
            </div>
            <p className="text-[10px] text-gray-600 px-1">
              Language tells the crawler which region's news sources to search for this keyword.
            </p>
          </div>

          {/* Keyword list */}
          {watchlist.length === 0 ? (
            <p className="text-gray-600 text-xs text-center py-6">
              {t("noKeywords")}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <AnimatePresence>
                {watchlist.map((kw) => (
                  <motion.div
                    key={kw._id}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-white/5 border border-white/10 group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Active dot */}
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${kw.active ? "bg-green-400" : "bg-gray-600"}`} />
                      <span className="text-sm text-gray-200 truncate">{kw.keyword}</span>
                      <span className="text-[10px] text-gray-600 bg-white/5 px-1.5 py-0.5 rounded">
                        {LOCALES.find(l => l.value === kw.locale)?.label.split(" (")[0] ?? kw.locale}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={() => handleToggle(kw._id)}
                        title={kw.active ? t("disable") : t("enable")}
                        className="text-[10px] px-2 py-1 rounded-lg border border-white/10 hover:border-white/20 text-gray-500 hover:text-gray-300 transition"
                      >
                        {kw.active ? t("pause") : t("resume")}
                      </button>
                      <button
                        onClick={() => handleDelete(kw._id, kw.keyword)}
                        title={t("remove")}
                        className="text-[10px] px-2 py-1 rounded-lg border border-red-500/20 hover:border-red-500/40 text-red-500/60 hover:text-red-400 transition"
                      >
                        ✕
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      {/* Suggestions tab */}
      {tab === "suggestions" && (
        <div className="flex flex-col gap-2">
          {suggestions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600 text-xs">{t("noSuggestions")}</p>
              <p className="text-gray-700 text-[10px] mt-1">{t("noSuggestionsHint")}</p>
            </div>
          ) : (
            <AnimatePresence>
              {suggestions.map((s) => (
                <motion.div
                  key={s._id}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex flex-col gap-2 px-3 py-3 rounded-xl bg-violet-500/5 border border-violet-500/20"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="text-sm text-gray-100 font-medium">{s.keyword}</span>
                      <span className="text-[10px] text-gray-500 leading-relaxed">{s.reason}</span>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleApprove(s._id, s.keyword)}
                        className="px-2.5 py-1 bg-green-600/30 hover:bg-green-600/50 border border-green-500/30 rounded-lg text-[10px] text-green-400 font-medium transition"
                      >
                        {t("approve")}
                      </button>
                      <button
                        onClick={() => handleReject(s._id, s.keyword)}
                        className="px-2.5 py-1 bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 rounded-lg text-[10px] text-red-400 transition"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <div className="text-[9px] text-gray-700">
                    {t("suggestedAt")} {new Date(s.suggestedAt).toLocaleString(locale === "zh" ? "zh-TW" : "en-US")}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      )}
    </div>
  );
}