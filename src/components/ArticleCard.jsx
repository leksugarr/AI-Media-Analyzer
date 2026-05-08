// ArticleCard.jsx
// Supports two usage modes:
//   1. <ArticleCard article={articleObj} /> — renders full card with credibility badge
//   2. <ArticleCard className="...">children</ArticleCard> — legacy wrapper mode

import { useTranslations, useLocale } from "next-intl";

const CREDIBILITY_STYLE = {
  likely_fake: { bg: "#2d0a0a", border: "#7f1d1d", color: "#f87171" },
  suspicious:  { bg: "#2d1f00", border: "#78350f", color: "#fbbf24" },
  credible:    { bg: "#051a10", border: "#14532d", color: "#4ade80" },
};

const SENTIMENT_COLOR = {
  POSITIVE: "#4ade80",
  NEGATIVE: "#f87171",
  NEUTRAL:  "#facc15",
};

export default function ArticleCard({ article, children, className }) {
  const t = useTranslations("filter");
  const locale = useLocale();

  // ── Legacy wrapper mode ──────────────────────────────────────────────────────
  if (!article) {
    return (
      <div className={`p-6 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-lg ${className || ""}`}>
        {children}
      </div>
    );
  }

  // ── Full article card mode ────────────────────────────────────────────────────
  const {
    title, url, source, description,
    sentiment, credibility, publishedAt, keywords,
  } = article;

  const credStyle = credibility?.label ? CREDIBILITY_STYLE[credibility.label] : null;
  const credLabel = credibility?.label === "likely_fake" ? t("likelyFake")
    : credibility?.label === "suspicious" ? t("suspicious")
    : credibility?.label === "credible" ? t("credible")
    : null;

  const sentColor = SENTIMENT_COLOR[sentiment?.label?.toUpperCase()] || "#4a5a7a";
  const sentLabel = sentiment?.label === "POSITIVE" ? t("positive")
    : sentiment?.label === "NEGATIVE" ? t("negative")
    : sentiment?.label === "NEUTRAL" ? t("neutral")
    : sentiment?.label || "";

  const dateLocale = locale === "zh" ? "zh-TW" : "en-US";
  const date = publishedAt ? new Date(publishedAt).toLocaleDateString(dateLocale, { month: "short", day: "numeric" }) : "";

  return (
    <div style={{
      background: "#0f1117",
      border: `1px solid ${credStyle ? credStyle.border : "#1e2130"}`,
      borderRadius: 14,
      padding: "16px 18px",
      display: "flex",
      flexDirection: "column",
      gap: 10,
      transition: "border-color 0.2s",
    }}>

      {/* Top row: source + date + credibility badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {source && (
          <span style={{
            fontSize: 11, color: "#4a5a7a", background: "#1a1f2e",
            border: "1px solid #1e2538", borderRadius: 6, padding: "2px 8px",
          }}>
            {source}
          </span>
        )}
        {date && (
          <span style={{ fontSize: 11, color: "#3d4a6b" }}>{date}</span>
        )}

        {/* Credibility badge */}
        {credStyle && (
          <span
            title={credibility.reason || ""}
            style={{
              fontSize: 11, fontWeight: 600,
              background: credStyle.bg,
              border: `1px solid ${credStyle.border}`,
              color: credStyle.color,
              borderRadius: 6,
              padding: "2px 8px",
              marginLeft: "auto",
              cursor: credibility.reason ? "help" : "default",
            }}
          >
            {credLabel}
          </span>
        )}
      </div>

      {/* Title */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          color: "#c8d3f0",
          fontWeight: 600,
          fontSize: 14,
          lineHeight: 1.45,
          textDecoration: "none",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {title}
      </a>

      {/* Description */}
      {description && (
        <p style={{
          color: "#4a5a7a",
          fontSize: 12,
          lineHeight: 1.5,
          margin: 0,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          {description}
        </p>
      )}

      {/* Bottom row: sentiment + keywords */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
        {sentiment?.label && (
          <span style={{
            fontSize: 11, fontWeight: 600,
            color: sentColor,
            background: `${sentColor}18`,
            border: `1px solid ${sentColor}44`,
            borderRadius: 6,
            padding: "2px 8px",
          }}>
            {sentLabel}
          </span>
        )}
        {keywords?.slice(0, 3).map(kw => (
          <span key={kw} style={{
            fontSize: 11, color: "#3d4a6b",
            background: "#1a1f2e",
            border: "1px solid #1e2538",
            borderRadius: 6,
            padding: "2px 7px",
          }}>
            {kw}
          </span>
        ))}

        {/* Credibility reason hint */}
        {credibility?.reason && credibility.label !== "credible" && (
          <span style={{ fontSize: 11, color: "#3d4a6b", marginLeft: "auto", fontStyle: "italic" }}>
            {credibility.reason.slice(0, 60)}{credibility.reason.length > 60 ? "…" : ""}
          </span>
        )}
      </div>
    </div>
  );
}