"use client";

import { useState, useEffect, useCallback } from "react";

// Proxy routes in src/app/api/topics/* forward to the Express backend
const TOPICS_BASE = "/api/topics";

function getAuthHeaders() {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

const DAYS_OPTIONS = [
  { value: 7,   label: "7 days" },
  { value: 30,  label: "30 days" },
  { value: 90,  label: "90 days" },
  { value: 365, label: "All time" },
];

// Emoji icons for each topic label
const TOPIC_ICONS = {
  "科技產業": "💻",
  "政治選舉": "🗳️",
  "經濟金融": "📈",
  "國際關係": "🌐",
  "社會民生": "🏘️",
  "環境氣候": "🌿",
  "健康醫療": "🏥",
  "娛樂文化": "🎭",
  "軍事安全": "🛡️",
  "教育學術": "🎓",
};

export default function TopicModelingPanel() {
  const [status, setStatus]           = useState(null);
  const [topics, setTopics]           = useState([]);
  const [days, setDays]               = useState(30);
  const [loadingDist, setLoadingDist] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [running, setRunning]         = useState(false);
  const [toast, setToast]             = useState(null);

  function showToast(msg, type = "info") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const r = await fetch(`${TOPICS_BASE}/status`, { headers: getAuthHeaders() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setStatus(await r.json());
    } catch (e) {
      console.warn("[Topics] Status load failed:", e.message);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  const loadDistribution = useCallback(async (d) => {
    setLoadingDist(true);
    setTopics([]);
    try {
      const r = await fetch(`${TOPICS_BASE}/distribution?days=${d}`, {
        headers: getAuthHeaders(),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setTopics(data.topics || []);
    } catch (e) {
      console.warn("[Topics] Distribution load failed:", e.message);
    } finally {
      setLoadingDist(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadDistribution(days);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleDaysChange(e) {
    const val = parseInt(e.target.value);
    setDays(val);
    loadDistribution(val);
  }

  async function runPipeline() {
    setRunning(true);
    try {
      const r = await fetch(`${TOPICS_BASE}/run`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ limit: 50 }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed");
      showToast(data.message || "Pipeline started — results will appear shortly.", "info");
      setTimeout(() => {
        loadStatus();
        loadDistribution(days);
      }, 4000);
    } catch (e) {
      showToast("Pipeline start failed: " + e.message, "err");
    } finally {
      setRunning(false);
    }
  }

  const pct =
    status && status.total > 0
      ? Math.round((status.clustered / status.total) * 100)
      : 0;
  const topicCount = status?.distribution?.length ?? (topics.length || "—");
  const maxTotal   = Math.max(...topics.map((t) => t.total), 1);

  return (
    <div className="topic-panel">

      {/* ── Header ── */}
      <div className="tp-header">
        <div className="tp-title-group">
          <span className="tp-title-icon">🧩</span>
          <p className="tp-title">Topic Modeling</p>
        </div>
        <div className="tp-controls">
          <select
            value={days}
            onChange={handleDaysChange}
            className="tp-select"
          >
            {DAYS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            onClick={runPipeline}
            disabled={running}
            className={`tp-run-btn ${running ? "tp-run-btn--running" : ""}`}
          >
            <span className={`tp-btn-icon ${running ? "tp-spin" : ""}`}>
              {running ? "↻" : "▶"}
            </span>
            {running ? "Running…" : "Run pipeline"}
          </button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="tp-cards">
        {[
          {
            label: "Analyzed articles",
            value: loadingStatus ? "…" : (status ? status.total.toLocaleString() : "—"),
            sub: null,
            icon: "📰",
            accent: "#378ADD",
          },
          {
            label: "Clustered",
            value: loadingStatus ? "…" : (status ? status.clustered.toLocaleString() : "—"),
            sub: status && !loadingStatus ? `${pct}% coverage` : null,
            icon: "🏷️",
            accent: "#5DCAA5",
            highlight: true,
          },
          {
            label: "Unclustered",
            value: loadingStatus ? "…" : (status ? status.unclustered.toLocaleString() : "—"),
            sub: null,
            icon: "❓",
            accent: "#F09595",
          },
          {
            label: "Topic clusters",
            value: loadingStatus ? "…" : String(topicCount),
            sub: null,
            icon: "🗂️",
            accent: "#C084FC",
          },
        ].map((card) => (
          <div key={card.label} className={`tp-card ${card.highlight ? "tp-card--highlight" : ""}`}>
            <div className="tp-card-top">
              <span className="tp-card-icon">{card.icon}</span>
              <p className="tp-card-label">{card.label}</p>
            </div>
            <p className="tp-card-value" style={{ color: card.accent }}>{card.value}</p>
            {card.sub && (
              <div className="tp-card-sub-row">
                <div className="tp-coverage-bar">
                  <div
                    className="tp-coverage-fill"
                    style={{ width: `${pct}%`, background: card.accent }}
                  />
                </div>
                <span className="tp-card-sub">{card.sub}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className={`tp-toast tp-toast--${toast.type}`}>
          <span className="tp-toast-icon">{toast.type === "err" ? "⚠️" : "✅"}</span>
          {toast.msg}
        </div>
      )}

      {/* ── Distribution Section ── */}
      <div className="tp-distribution">
        <div className="tp-dist-header">
          <p className="tp-dist-title">Sentiment breakdown by topic</p>
          <span className="tp-dist-period">
            {days === 365 ? "All time" : `Last ${days} days`}
          </span>
        </div>

        {loadingDist ? (
          <div className="tp-loading">
            <div className="tp-loading-dots">
              <span /><span /><span />
            </div>
            <p>Loading topic data…</p>
          </div>
        ) : topics.length === 0 ? (
          <div className="tp-empty">
            <p className="tp-empty-icon">🧩</p>
            <p className="tp-empty-title">No clustered articles in this period</p>
            <p className="tp-empty-sub">Run the pipeline to assign topic clusters to analyzed articles.</p>
          </div>
        ) : (
          <>
            <div className="tp-bars">
              {topics.map((t, i) => {
                const pPos = t.total > 0 ? Math.round((t.positive / t.total) * 100) : 0;
                const pNeu = t.total > 0 ? Math.round((t.neutral  / t.total) * 100) : 0;
                const pNeg = Math.max(0, 100 - pPos - pNeu);
                const barW = Math.round((t.total / maxTotal) * 100);
                const conf = Math.round((t.avgConfidence || 0) * 100);
                const icon = TOPIC_ICONS[t.label] || "📌";
                const dominantSentiment = pPos >= pNeu && pPos >= pNeg
                  ? "positive"
                  : pNeg >= pPos && pNeg >= pNeu
                    ? "negative"
                    : "neutral";

                return (
                  <div
                    key={t.label}
                    className="tp-bar-row"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    {/* Label */}
                    <div className="tp-bar-label">
                      <span className="tp-bar-icon">{icon}</span>
                      <span className="tp-bar-text" title={t.label}>{t.label}</span>
                    </div>

                    {/* Bar + confidence */}
                    <div className="tp-bar-track-wrap">
                      <div className="tp-bar-track">
                        {/* Background proportional to maxTotal */}
                        <div
                          className="tp-bar-fill-outer"
                          style={{ width: `${barW}%` }}
                        >
                          <div className="tp-bar-seg tp-bar-pos" style={{ width: `${pPos}%` }} />
                          <div className="tp-bar-seg tp-bar-neu" style={{ width: `${pNeu}%` }} />
                          <div className="tp-bar-seg tp-bar-neg" style={{ width: `${pNeg}%` }} />
                        </div>
                      </div>

                      {/* Percentage pills */}
                      <div className="tp-pct-row">
                        {pPos > 0 && <span className="tp-pct tp-pct--pos">+{pPos}%</span>}
                        {pNeu > 0 && <span className="tp-pct tp-pct--neu">{pNeu}%</span>}
                        {pNeg > 0 && <span className="tp-pct tp-pct--neg">-{pNeg}%</span>}
                      </div>

                      {/* Confidence row */}
                      <div className="tp-conf-row">
                        <span className="tp-conf-label">conf.</span>
                        <div className="tp-conf-track">
                          <div className="tp-conf-fill" style={{ width: `${conf}%` }} />
                        </div>
                        <span className="tp-conf-value">{conf}%</span>
                      </div>
                    </div>

                    {/* Count */}
                    <div className="tp-bar-count">
                      <span className={`tp-sentiment-dot tp-sentiment-dot--${dominantSentiment}`} />
                      <span>{t.total}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="tp-legend">
              {[
                { color: "#5DCAA5", label: "Positive", cls: "pos" },
                { color: "#B4B2A9", label: "Neutral",  cls: "neu" },
                { color: "#F09595", label: "Negative", cls: "neg" },
              ].map((l) => (
                <span key={l.label} className="tp-legend-item">
                  <span className="tp-legend-dot" style={{ background: l.color }} />
                  {l.label}
                </span>
              ))}
              <span className="tp-legend-item tp-legend-conf">
                <span className="tp-legend-dot" style={{ background: "#378ADD" }} />
                Confidence
              </span>
            </div>
          </>
        )}
      </div>

      <style>{`
        /* ── Panel wrapper ── */
        .topic-panel {
          padding: 1.5rem 0;
          font-family: var(--font-sans, sans-serif);
        }

        /* ── Header ── */
        .tp-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 1.25rem;
        }
        .tp-title-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .tp-title-icon { font-size: 18px; }
        .tp-title {
          margin: 0;
          font-size: 15px;
          font-weight: 600;
          color: var(--color-text-primary);
          letter-spacing: -0.01em;
        }
        .tp-controls {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .tp-select {
          font-size: 13px;
          padding: 5px 8px;
          border-radius: var(--border-radius-md, 6px);
          border: 0.5px solid var(--color-border-secondary);
          background: var(--color-background-primary);
          color: var(--color-text-primary);
          cursor: pointer;
          outline: none;
          transition: border-color 0.15s;
        }
        .tp-select:hover { border-color: var(--color-border-primary); }
        .tp-run-btn {
          font-size: 13px;
          padding: 5px 14px;
          border-radius: var(--border-radius-md, 6px);
          border: 0.5px solid var(--color-border-secondary);
          background: var(--color-background-primary);
          color: var(--color-text-primary);
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: background 0.15s, opacity 0.15s;
          font-weight: 500;
        }
        .tp-run-btn:hover:not(:disabled) {
          background: var(--color-background-secondary);
        }
        .tp-run-btn--running {
          opacity: 0.65;
          cursor: not-allowed;
        }
        .tp-btn-icon { font-size: 12px; }
        .tp-spin {
          display: inline-block;
          animation: tp-spin 0.9s linear infinite;
        }
        @keyframes tp-spin { to { transform: rotate(360deg); } }

        /* ── Stat Cards ── */
        .tp-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          gap: 10px;
          margin-bottom: 1.25rem;
        }
        .tp-card {
          background: var(--color-background-secondary);
          border-radius: var(--border-radius-md, 6px);
          padding: 0.85rem 1rem;
          border: 0.5px solid transparent;
          transition: border-color 0.2s;
          position: relative;
          overflow: hidden;
        }
        .tp-card--highlight {
          border-color: var(--color-border-secondary);
        }
        .tp-card-top {
          display: flex;
          align-items: center;
          gap: 5px;
          margin-bottom: 6px;
        }
        .tp-card-icon { font-size: 13px; }
        .tp-card-label {
          margin: 0;
          font-size: 11px;
          color: var(--color-text-secondary);
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .tp-card-value {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
          letter-spacing: -0.02em;
          line-height: 1;
        }
        .tp-card-sub-row {
          margin-top: 8px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .tp-coverage-bar {
          flex: 1;
          height: 3px;
          border-radius: 2px;
          background: var(--color-border-secondary);
          overflow: hidden;
        }
        .tp-coverage-fill {
          height: 100%;
          border-radius: 2px;
          transition: width 0.6s ease;
        }
        .tp-card-sub {
          font-size: 10px;
          color: var(--color-text-tertiary);
          white-space: nowrap;
        }

        /* ── Toast ── */
        .tp-toast {
          margin-bottom: 12px;
          padding: 8px 12px;
          border-radius: var(--border-radius-md, 6px);
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 8px;
          animation: tp-fadein 0.2s ease;
        }
        .tp-toast--info {
          background: var(--color-background-info, rgba(55,138,221,0.1));
          color: var(--color-text-info, #378ADD);
          border: 0.5px solid var(--color-border-info, rgba(55,138,221,0.3));
        }
        .tp-toast--err {
          background: var(--color-background-danger, rgba(240,149,149,0.1));
          color: var(--color-text-danger, #e05555);
          border: 0.5px solid var(--color-border-danger, rgba(240,149,149,0.3));
        }
        .tp-toast-icon { font-size: 14px; }
        @keyframes tp-fadein {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Distribution ── */
        .tp-distribution { margin-top: 1.25rem; }
        .tp-dist-header {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          margin-bottom: 14px;
          flex-wrap: wrap;
          gap: 4px;
        }
        .tp-dist-title {
          margin: 0;
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text-primary);
        }
        .tp-dist-period {
          font-size: 11px;
          color: var(--color-text-tertiary);
          background: var(--color-background-secondary);
          padding: 2px 7px;
          border-radius: 20px;
          border: 0.5px solid var(--color-border-secondary);
        }

        /* ── Loading ── */
        .tp-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          padding: 2.5rem;
          color: var(--color-text-tertiary);
          font-size: 13px;
        }
        .tp-loading p { margin: 0; }
        .tp-loading-dots {
          display: flex;
          gap: 5px;
        }
        .tp-loading-dots span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--color-text-tertiary);
          animation: tp-bounce 1.2s ease-in-out infinite;
        }
        .tp-loading-dots span:nth-child(2) { animation-delay: 0.2s; }
        .tp-loading-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes tp-bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }

        /* ── Empty state ── */
        .tp-empty {
          text-align: center;
          padding: 2.5rem 1rem;
          color: var(--color-text-tertiary);
        }
        .tp-empty-icon { font-size: 32px; margin: 0 0 8px; }
        .tp-empty-title {
          font-size: 14px;
          font-weight: 500;
          color: var(--color-text-secondary);
          margin: 0 0 4px;
        }
        .tp-empty-sub { font-size: 12px; margin: 0; }

        /* ── Bars ── */
        .tp-bars {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .tp-bar-row {
          display: grid;
          grid-template-columns: 110px 1fr 52px;
          align-items: center;
          gap: 10px;
          animation: tp-fadein 0.3s ease both;
        }

        /* Label column */
        .tp-bar-label {
          display: flex;
          align-items: center;
          gap: 5px;
          justify-content: flex-end;
          text-align: right;
        }
        .tp-bar-icon { font-size: 14px; flex-shrink: 0; }
        .tp-bar-text {
          font-size: 12px;
          color: var(--color-text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-weight: 500;
        }

        /* Bar column */
        .tp-bar-track-wrap { display: flex; flex-direction: column; gap: 3px; }
        .tp-bar-track {
          height: 18px;
          border-radius: 4px;
          background: var(--color-background-secondary);
          overflow: hidden;
          position: relative;
        }
        .tp-bar-fill-outer {
          height: 100%;
          display: flex;
          transition: width 0.7s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .tp-bar-seg { height: 100%; transition: width 0.7s ease; }
        .tp-bar-pos { background: #5DCAA5; }
        .tp-bar-neu { background: #B4B2A9; }
        .tp-bar-neg { background: #F09595; }

        .tp-pct-row {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }
        .tp-pct {
          font-size: 10px;
          padding: 1px 5px;
          border-radius: 3px;
          font-weight: 600;
          line-height: 1.4;
        }
        .tp-pct--pos { background: rgba(93,202,165,0.15); color: #3aaa82; }
        .tp-pct--neu { background: rgba(180,178,169,0.15); color: var(--color-text-secondary); }
        .tp-pct--neg { background: rgba(240,149,149,0.15); color: #d94f4f; }

        .tp-conf-row {
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .tp-conf-label {
          font-size: 10px;
          color: var(--color-text-tertiary);
          flex-shrink: 0;
        }
        .tp-conf-track {
          flex: 1;
          height: 3px;
          border-radius: 2px;
          background: var(--color-border-secondary);
          overflow: hidden;
        }
        .tp-conf-fill {
          height: 100%;
          border-radius: 2px;
          background: #378ADD;
          transition: width 0.7s ease;
        }
        .tp-conf-value {
          font-size: 10px;
          color: var(--color-text-tertiary);
          flex-shrink: 0;
          width: 26px;
          text-align: right;
        }

        /* Count column */
        .tp-bar-count {
          display: flex;
          align-items: center;
          gap: 5px;
          justify-content: flex-end;
          font-size: 12px;
          color: var(--color-text-secondary);
          font-weight: 500;
        }
        .tp-sentiment-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .tp-sentiment-dot--positive { background: #5DCAA5; }
        .tp-sentiment-dot--neutral  { background: #B4B2A9; }
        .tp-sentiment-dot--negative { background: #F09595; }

        /* ── Legend ── */
        .tp-legend {
          display: flex;
          gap: 14px;
          margin-top: 14px;
          flex-wrap: wrap;
          align-items: center;
          padding-top: 10px;
          border-top: 0.5px solid var(--color-border-secondary);
        }
        .tp-legend-item {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          color: var(--color-text-secondary);
        }
        .tp-legend-dot {
          width: 9px;
          height: 9px;
          border-radius: 2px;
          flex-shrink: 0;
        }
        .tp-legend-conf .tp-legend-dot {
          border-radius: 50%;
        }
      `}</style>
    </div>
  );
}