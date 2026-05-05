"use client";
import { useState } from "react";

/**
 * FilterSidebar
 *
 * Props:
 *   onFilter({ keyword, dateFrom, dateTo, source, sentiment }) — called when user applies filters
 *   onReset()                                                  — called when user clears all filters
 */

const SOURCES = [
  { value: "",           label: "All Sources" },
  { value: "googleNews", label: "Google News" },
  { value: "ptt",        label: "PTT" },
];

const SENTIMENTS = [
  { value: "",         label: "All",      dot: "#4a5a7a" },
  { value: "POSITIVE", label: "Positive", dot: "#4ade80" },
  { value: "NEGATIVE", label: "Negative", dot: "#f87171" },
  { value: "NEUTRAL",  label: "Neutral",  dot: "#facc15" },
];

const CREDIBILITIES = [
  { value: "",            label: "All",          dot: "#4a5a7a" },
  { value: "credible",    label: "✅ Credible",   dot: "#4ade80" },
  { value: "suspicious",  label: "⚠️ Suspicious", dot: "#fbbf24" },
  { value: "likely_fake", label: "🚨 Likely Fake", dot: "#f87171" },
];

export default function FilterSidebar({ onFilter, onReset }) {
  const [keyword, setKeyword]         = useState("");
  const [dateFrom, setDateFrom]       = useState("");
  const [dateTo, setDateTo]           = useState("");
  const [source, setSource]           = useState("");
  const [sentiment, setSentiment]     = useState("");
  const [credibility, setCredibility] = useState("");
  const [open, setOpen]               = useState(true);

  function handleApply() {
    onFilter({ keyword: keyword.trim(), dateFrom, dateTo, source, sentiment, credibility });
  }

  function handleReset() {
    setKeyword("");
    setDateFrom("");
    setDateTo("");
    setSource("");
    setSentiment("");
    setCredibility("");
    onReset();
  }

  const hasFilters = keyword || dateFrom || dateTo || source || sentiment || credibility;

  return (
    <aside
      style={{
        width: open ? 260 : 48,
        minHeight: "100%",
        background: "#0f1117",
        borderRight: "1px solid #1e2130",
        transition: "width 0.25s cubic-bezier(.4,0,.2,1)",
        overflow: "hidden",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        title={open ? "Collapse filters" : "Expand filters"}
        style={{
          position: "absolute",
          top: 16,
          right: open ? 12 : "50%",
          transform: open ? "none" : "translateX(50%)",
          background: "#1a1f2e",
          border: "1px solid #2a2f45",
          borderRadius: 8,
          color: "#7c8db5",
          width: 28,
          height: 28,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          fontSize: 13,
          zIndex: 10,
          transition: "all 0.25s",
        }}
      >
        {open ? "←" : "→"}
      </button>

      {/* Collapsed label */}
      {!open && (
        <div
          style={{
            marginTop: 60,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            color: "#3d4a6b",
            fontSize: 11,
            letterSpacing: 2,
            writingMode: "vertical-rl",
            userSelect: "none",
          }}
        >
          FILTERS
          {hasFilters && (
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#4f7cff",
                display: "inline-block",
                writingMode: "horizontal-tb",
              }}
            />
          )}
        </div>
      )}

      {/* Sidebar content */}
      {open && (
        <div style={{ padding: "16px 20px 24px", display: "flex", flexDirection: "column", gap: 24, marginTop: 44, overflowY: "auto" }}>

          {/* Header */}
          <div>
            <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 14, letterSpacing: 0.5 }}>
              Search & Filter
            </div>
            <div style={{ color: "#3d4a6b", fontSize: 11, marginTop: 2 }}>
              Narrow down articles
            </div>
          </div>

          {/* Keyword */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={labelStyle}>Keyword</label>
            <div style={{ position: "relative" }}>
              <span style={{
                position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
                color: "#3d4a6b", fontSize: 13, pointerEvents: "none"
              }}>🔍</span>
              <input
                type="text"
                placeholder="Search articles..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleApply()}
                style={{ ...inputStyle, paddingLeft: 32 }}
              />
            </div>
          </div>

          {/* Source */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={labelStyle}>Source</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {SOURCES.map((s) => (
                <ToggleButton
                  key={s.value}
                  label={s.label}
                  active={source === s.value}
                  dotColor="#2a4fff"
                  onClick={() => setSource(s.value)}
                />
              ))}
            </div>
          </div>

          {/* Sentiment */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={labelStyle}>Sentiment</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {SENTIMENTS.map((s) => (
                <ToggleButton
                  key={s.value}
                  label={s.label}
                  active={sentiment === s.value}
                  dotColor={s.dot}
                  onClick={() => setSentiment(s.value)}
                />
              ))}
            </div>
          </div>

          {/* Credibility */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={labelStyle}>Credibility</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {CREDIBILITIES.map((c) => (
                <ToggleButton
                  key={c.value}
                  label={c.label}
                  active={credibility === c.value}
                  dotColor={c.dot}
                  onClick={() => setCredibility(c.value)}
                />
              ))}
            </div>
          </div>

          {/* Date range */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={labelStyle}>Date Range</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div>
                <div style={sublabelStyle}>From</div>
                <input
                  type="date"
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={(e) => setDateFrom(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <div style={sublabelStyle}>To</div>
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(e) => setDateTo(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* Active filter pills */}
          {hasFilters && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {keyword && (
                <Pill label={`"${keyword}"`} onRemove={() => { setKeyword(""); onFilter({ keyword: "", dateFrom, dateTo, source, sentiment, credibility }); }} />
              )}
              {source && (
                <Pill label={SOURCES.find(s => s.value === source)?.label || source} onRemove={() => { setSource(""); onFilter({ keyword, dateFrom, dateTo, source: "", sentiment, credibility }); }} />
              )}
              {sentiment && (
                <Pill
                  label={SENTIMENTS.find(s => s.value === sentiment)?.label || sentiment}
                  color={SENTIMENTS.find(s => s.value === sentiment)?.dot}
                  onRemove={() => { setSentiment(""); onFilter({ keyword, dateFrom, dateTo, source, sentiment: "", credibility }); }}
                />
              )}
              {credibility && (
                <Pill
                  label={CREDIBILITIES.find(c => c.value === credibility)?.label || credibility}
                  color={CREDIBILITIES.find(c => c.value === credibility)?.dot}
                  onRemove={() => { setCredibility(""); onFilter({ keyword, dateFrom, dateTo, source, sentiment, credibility: "" }); }}
                />
              )}
              {dateFrom && (
                <Pill label={`From ${dateFrom}`} onRemove={() => { setDateFrom(""); onFilter({ keyword, dateFrom: "", dateTo, source, sentiment, credibility }); }} />
              )}
              {dateTo && (
                <Pill label={`To ${dateTo}`} onRemove={() => { setDateTo(""); onFilter({ keyword, dateFrom, dateTo: "", source, sentiment, credibility }); }} />
              )}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button onClick={handleApply} style={applyBtnStyle}>
              Apply Filters
            </button>
            {hasFilters && (
              <button onClick={handleReset} style={resetBtnStyle}>
                Clear All
              </button>
            )}
          </div>

        </div>
      )}
    </aside>
  );
}

// ─── Shared toggle button ──────────────────────────────────────────────────────
function ToggleButton({ label, active, dotColor, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? "#1a2540" : "transparent",
        border: `1px solid ${active ? dotColor : "#1e2538"}`,
        borderRadius: 8,
        color: active ? "#c8d3f0" : "#4a5a7a",
        fontSize: 12,
        padding: "7px 12px",
        cursor: "pointer",
        textAlign: "left",
        display: "flex",
        alignItems: "center",
        gap: 8,
        transition: "all 0.15s",
        width: "100%",
      }}
    >
      <span style={{
        width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
        background: active ? dotColor : "#1e2538",
        transition: "background 0.15s",
      }} />
      {label}
    </button>
  );
}

// ─── Pill ──────────────────────────────────────────────────────────────────────
function Pill({ label, color, onRemove }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: "#1a2540", border: "1px solid #2a3a60",
      borderRadius: 20, padding: "2px 8px",
      color: color || "#7c9ef5", fontSize: 11,
    }}>
      {label}
      <button
        onClick={onRemove}
        style={{ background: "none", border: "none", color: "#4f5f8a", cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 0 }}
      >×</button>
    </span>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const labelStyle = {
  color: "#7c8db5",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 1,
  textTransform: "uppercase",
};

const sublabelStyle = {
  color: "#3d4a6b",
  fontSize: 10,
  marginBottom: 4,
  letterSpacing: 0.5,
};

const inputStyle = {
  width: "100%",
  background: "#0a0d14",
  border: "1px solid #1e2538",
  borderRadius: 8,
  padding: "8px 10px",
  color: "#c8d3f0",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
  colorScheme: "dark",
};

const applyBtnStyle = {
  background: "#2a4fff",
  border: "none",
  borderRadius: 8,
  color: "#fff",
  fontWeight: 600,
  fontSize: 13,
  padding: "9px 0",
  cursor: "pointer",
  letterSpacing: 0.3,
  width: "100%",
};

const resetBtnStyle = {
  background: "transparent",
  border: "1px solid #1e2538",
  borderRadius: 8,
  color: "#5a6a8a",
  fontSize: 12,
  padding: "7px 0",
  cursor: "pointer",
  width: "100%",
};