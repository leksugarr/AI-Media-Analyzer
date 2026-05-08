"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";

const FEATURES = [
  {
    icon: "🔍",
    en: "Multi-Source Crawling",
    zh: "多來源爬蟲",
    desc_en: "Automatically collects articles from Google News, PTT, and YouTube every 2 hours.",
    desc_zh: "每兩小時自動從 Google News、PTT、YouTube 抓取最新文章。",
  },
  {
    icon: "🧠",
    en: "AI Sentiment Analysis",
    zh: "AI 情緒分析",
    desc_en: "Every article is classified as Positive, Negative, or Neutral using Groq LLM.",
    desc_zh: "使用 Groq 大型語言模型將每篇文章分類為正面、負面或中立。",
  },
  {
    icon: "🗂️",
    en: "Topic Modeling",
    zh: "主題建模",
    desc_en: "Articles are clustered into 10 predefined topic categories such as 科技產業, 政治選舉, 經濟金融.",
    desc_zh: "文章自動分類至科技產業、政治選舉、經濟金融等十個主題群組。",
  },
  {
    icon: "⚖️",
    en: "Stance Detection",
    zh: "立場分析",
    desc_en: "Detects whether each article is supportive (支持), opposing (反對), or neutral (中立) toward its subject.",
    desc_zh: "偵測每篇文章對議題的立場：支持、反對或中立。",
  },
  {
    icon: "🔎",
    en: "Fake News Detection",
    zh: "假新聞偵測",
    desc_en: "Credibility scoring flags suspicious or likely fake articles before they reach the dashboard.",
    desc_zh: "可信度評分機制，在進入儀表板前標記可疑或可能為假的新聞。",
  },
  {
    icon: "📈",
    en: "Trend Prediction",
    zh: "趨勢預測",
    desc_en: "AI-generated 7-day forecasts based on historical sentiment patterns per keyword.",
    desc_zh: "根據各關鍵字的歷史情緒趨勢，由 AI 生成七天預測報告。",
  },
  {
    icon: "🗺️",
    en: "Sentiment Heatmap",
    zh: "情緒熱圖",
    desc_en: "A 12-week grid showing sentiment intensity per keyword — spot trends at a glance.",
    desc_zh: "12 週關鍵字情緒強度熱圖，一眼掌握趨勢變化。",
  },
  {
    icon: "🤖",
    en: "LINE Bot Alerts",
    zh: "LINE Bot 通知",
    desc_en: "Instant push notifications via LINE when a sentiment spike is detected.",
    desc_zh: "偵測到情緒驟變時，即時透過 LINE 推播通知。",
  },
  {
    icon: "💬",
    en: "AI Chat Interface",
    zh: "AI 對話介面",
    desc_en: "Ask questions about any topic — the AI searches the web and summarizes findings in real time.",
    desc_zh: "針對任何議題提問，AI 即時搜尋網路並彙整摘要。",
  },
];

const STACK = [
  { label: "Frontend", items: ["Next.js 16", "React 19", "Tailwind CSS", "Framer Motion"] },
  { label: "Backend", items: ["Express.js", "Node.js (ESM)", "MongoDB", "Mongoose"] },
  { label: "AI / APIs", items: ["Groq llama-3.3-70b", "Tavily Search", "YouTube Data API v3"] },
  { label: "Bot / Auth", items: ["LINE Messaging API", "JWT + bcrypt"] },
];

export default function AboutPage() {
const [visible, setVisible] = useState(false);
const locale = useLocale();
const lang = locale === "zh" ? "zh" : "en";
  const heroRef = useRef(null);

  useEffect(() => {
    setVisible(true);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#080b12",
        color: "#e8eaf0",
        fontFamily: "'DM Sans', 'Noto Sans TC', sans-serif",
        overflowX: "hidden",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,700;1,300&family=DM+Mono:wght@400;500&family=Noto+Sans+TC:wght@300;400;500;700&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .about-hero {
          position: relative;
          min-height: 92vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 120px 24px 80px;
          overflow: hidden;
        }

        .about-hero::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 80% 60% at 50% -10%, rgba(56,130,246,0.18) 0%, transparent 70%),
            radial-gradient(ellipse 40% 40% at 20% 80%, rgba(139,92,246,0.10) 0%, transparent 60%),
            radial-gradient(ellipse 40% 40% at 80% 90%, rgba(20,184,166,0.08) 0%, transparent 60%);
          pointer-events: none;
        }

        .grid-bg {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 48px 48px;
          pointer-events: none;
          mask-image: radial-gradient(ellipse 80% 80% at 50% 0%, black 40%, transparent 100%);
        }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          border: 1px solid rgba(56,130,246,0.3);
          border-radius: 100px;
          background: rgba(56,130,246,0.08);
          font-size: 11px;
          font-family: 'DM Mono', monospace;
          color: #60a5fa;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          margin-bottom: 28px;
          opacity: 0;
          transform: translateY(12px);
          transition: opacity 0.6s ease, transform 0.6s ease;
        }
        .hero-badge.vis { opacity: 1; transform: translateY(0); }

        .hero-title {
          font-size: clamp(2.4rem, 6vw, 4.5rem);
          font-weight: 700;
          line-height: 1.08;
          letter-spacing: -0.03em;
          margin-bottom: 10px;
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.7s ease 0.1s, transform 0.7s ease 0.1s;
        }
        .hero-title.vis { opacity: 1; transform: translateY(0); }

        .hero-title-zh {
          font-size: clamp(1.4rem, 3vw, 2.2rem);
          font-weight: 300;
          color: #6b7280;
          letter-spacing: 0.08em;
          margin-bottom: 28px;
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.7s ease 0.2s, transform 0.7s ease 0.2s;
        }
        .hero-title-zh.vis { opacity: 1; transform: translateY(0); }

        .hero-desc {
          max-width: 580px;
          font-size: 15px;
          line-height: 1.75;
          color: #9ca3af;
          margin-bottom: 16px;
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.7s ease 0.3s, transform 0.7s ease 0.3s;
        }
        .hero-desc.vis { opacity: 1; transform: translateY(0); }

        .hero-desc-zh {
          max-width: 520px;
          font-size: 13.5px;
          line-height: 1.9;
          color: #6b7280;
          margin-bottom: 44px;
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.7s ease 0.38s, transform 0.7s ease 0.38s;
        }
        .hero-desc-zh.vis { opacity: 1; transform: translateY(0); }

        .hero-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: center;
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.7s ease 0.45s, transform 0.7s ease 0.45s;
        }
        .hero-actions.vis { opacity: 1; transform: translateY(0); }

        .btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 28px;
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          border: 1px solid rgba(96,165,250,0.3);
          border-radius: 10px;
          color: #fff;
          font-size: 14px;
          font-weight: 500;
          text-decoration: none;
          transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
          box-shadow: 0 0 24px rgba(37,99,235,0.25);
        }
        .btn-primary:hover {
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          transform: translateY(-1px);
          box-shadow: 0 0 32px rgba(59,130,246,0.35);
        }

        .btn-secondary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 28px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          color: #d1d5db;
          font-size: 14px;
          font-weight: 500;
          text-decoration: none;
          transition: background 0.2s, border-color 0.2s, transform 0.15s;
        }
        .btn-secondary:hover {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.2);
          transform: translateY(-1px);
        }

        /* ── Section ── */
        .section {
          max-width: 1100px;
          margin: 0 auto;
          padding: 80px 24px;
        }

        .section-label {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: #3b82f6;
          margin-bottom: 12px;
        }

        .section-title {
          font-size: clamp(1.6rem, 3vw, 2.4rem);
          font-weight: 700;
          letter-spacing: -0.025em;
          margin-bottom: 6px;
          line-height: 1.15;
        }

        .section-title-zh {
          font-size: clamp(1rem, 2vw, 1.3rem);
          font-weight: 300;
          color: #6b7280;
          letter-spacing: 0.06em;
          margin-bottom: 48px;
        }

        /* ── Features ── */
        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 16px;
        }

        .feature-card {
          padding: 24px;
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px;
          transition: background 0.2s, border-color 0.2s, transform 0.2s;
        }
        .feature-card:hover {
          background: rgba(255,255,255,0.04);
          border-color: rgba(59,130,246,0.2);
          transform: translateY(-2px);
        }

        .feature-icon {
          font-size: 24px;
          margin-bottom: 14px;
          display: block;
        }

        .feature-title-en {
          font-size: 14px;
          font-weight: 600;
          color: #e8eaf0;
          margin-bottom: 2px;
        }

        .feature-title-zh {
          font-size: 11px;
          color: #4b5563;
          margin-bottom: 10px;
          letter-spacing: 0.05em;
        }

        .feature-desc-en {
          font-size: 12.5px;
          color: #9ca3af;
          line-height: 1.65;
          margin-bottom: 4px;
        }

        .feature-desc-zh {
          font-size: 11.5px;
          color: #4b5563;
          line-height: 1.7;
        }

        /* ── Divider ── */
        .divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent);
          margin: 0 24px;
        }

        /* ── Stack ── */
        .stack-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 16px;
        }

        .stack-card {
          padding: 20px 22px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
        }

        .stack-label {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #6b7280;
          margin-bottom: 12px;
        }

        .stack-items {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .stack-item {
          font-size: 12.5px;
          color: #d1d5db;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .stack-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #3b82f6;
          flex-shrink: 0;
        }

        /* ── Footer ── */
        .about-footer {
          border-top: 1px solid rgba(255,255,255,0.06);
          padding: 32px 24px;
          text-align: center;
          font-size: 12px;
          color: #374151;
        }
      `}</style>

      {/* ── Hero ── */}
      <section className="about-hero" ref={heroRef}>
        <div className="grid-bg" />

        <div className={`hero-badge ${visible ? "vis" : ""}`}>
          <span>●</span> 畢業專題 · Graduation Project
        </div>

        <h1 className={`hero-title ${visible ? "vis" : ""}`}>
          AI Opinion Analysis System
        </h1>
        <p className={`hero-title-zh ${visible ? "vis" : ""}`}>
          AI 輿情分析系統
        </p>

        <p className={`hero-desc ${visible ? "vis" : ""}`}>
          An automated platform that monitors, analyzes, and predicts social sentiment
          across news and social media — powered by large language models.
        </p>
        <p className={`hero-desc-zh ${visible ? "vis" : ""}`}>
          自動化輿情監控平台，整合新聞與社群媒體，透過大型語言模型進行情緒分析、主題建模與趨勢預測。
        </p>

        <div className={`hero-actions ${visible ? "vis" : ""}`}>
<Link href={`/${locale}/login`} className="btn-primary">
            進入系統 · Enter Dashboard →
          </Link>
<Link href={`/${locale}/dashboard`} className="btn-secondary">
            查看儀表板 · View Dashboard
          </Link>
        </div>
      </section>

      <div className="divider" />

      {/* ── Features ── */}
      <section className="section">
        <p className="section-label">Core Features</p>
        <h2 className="section-title">What the system does</h2>
        <p className="section-title-zh">系統功能概覽</p>

        <div className="features-grid">
          {FEATURES.map((f) => (
            <div className="feature-card" key={f[lang]}>
              <span className="feature-icon">{f.icon}</span>
              <p className="feature-title-en">{f[lang]}</p>
              <p className="feature-title-zh">{f[lang]}</p>
              <p className="feature-desc-en">{f[`desc_${lang}`]}</p>
              <p className="feature-desc-zh">{f[`desc_${lang}`]}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="divider" />

      {/* ── Tech Stack ── */}
      <section className="section">
        <p className="section-label">Technology</p>
        <h2 className="section-title">Built with</h2>
        <p className="section-title-zh">技術架構</p>

        <div className="stack-grid">
          {STACK.map((s) => (
            <div className="stack-card" key={s.label}>
              <p className="stack-label">{s.label}</p>
              <div className="stack-items">
                {s.items.map((item) => (
                  <div className="stack-item" key={item}>
                    <span className="stack-dot" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="about-footer">
        AI Opinion Analysis System · 輿情分析系統 · Graduation Project {new Date().getFullYear()}
      </footer>
    </div>
  );
}