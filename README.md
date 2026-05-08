# Sentiment_Analyzer (輿情分析系統)

AI-powered opinion monitoring platform that automatically collects, analyzes, and predicts social sentiment across multiple sources. Track keywords, detect fake news, model topics, and receive insights via a dashboard and LINE Bot.

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Configuration](#environment-configuration)
- [Running the App](#running-the-app)
- [API Endpoints](#api-endpoints)
- [Features](#features)
- [Troubleshooting](#troubleshooting)

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS, Framer Motion |
| Backend | Express.js, Node.js (ESM — `import/export` only) |
| Database | MongoDB + Mongoose |
| AI / Search | Groq (`llama-3.3-70b-versatile`), Tavily, local embedder |
| Auth | JWT + bcrypt |
| Bot | LINE Messaging API (`@line/bot-sdk` v3+) |

## Project Structure

```
Sentiment_Analyzer/
├── package.json                  # Frontend dependencies
├── backend/
│   ├── server.js
│   ├── routes.js
│   ├── config.js
│   ├── db.js
│   ├── middleware.js
│   ├── crawler.js                # Auto-crawl scheduler + AI pipelines
│   ├── embedder.js               # Local semantic embeddings
│   ├── package.json              # Backend dependencies (separate)
│   └── crawlers/
│       ├── googleNews.js
│       └── ptt.js
└── src/
    ├── app/
    │   ├── dashboard/page.jsx    # Main dashboard
    │   ├── login/page.jsx
    │   ├── signup/page.jsx
    │   └── api/                  # Next.js API routes (proxies to Express)
    ├── components/
    │   ├── ArticleCard.jsx
    │   ├── KeywordHeatmap.jsx
    │   ├── KeywordWatchlistPanel.jsx
    │   ├── StancePanel.jsx
    │   ├── TopicModelingPanel.jsx
    │   └── TrendPredictionPanel.jsx
    └── context/
        └── AuthContext.jsx
```

> ⚠️ There are **two separate `node_modules`** — one at root (frontend) and one inside `backend/`. Install dependencies in both.

## Prerequisites

- **Node.js** v18+
- **MongoDB** (Atlas recommended)
- **API Keys:**
  - [Groq API Key](https://console.groq.com) — AI analysis, summarization, topic modeling, stance, credibility
  - [Tavily API Key](https://tavily.com) — real-time web search for conversations
  - LINE Channel Secret + Access Token — for LINE Bot

## Installation

### Frontend

```bash
npm install
```

### Backend

```bash
cd backend
npm install
```

## Environment Configuration

Create a `.env` file in the `backend/` directory:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname

# API Keys
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxx
TAVILY_API_KEY=tvly-xxxxxxxxxxxxxxxxxxxxxx

# Scheduler
NEWS_CRON_SCHEDULE=0 */2 * * *

# CORS
CORS_ORIGIN=http://localhost:3000

# LINE Bot
LINE_CHANNEL_SECRET=xxxxxxxxxxxxxxxxxxxxxx
LINE_CHANNEL_ACCESS_TOKEN=xxxxxxxxxxxxxxxxxxxxxx
```

## Running the App

### Backend (port 5000)

```bash
cd backend
npm run dev
```

Expected output:
```
✅ MongoDB connected successfully
[Scheduler] News crawler scheduled: "0 */2 * * *"
Backend running on http://localhost:5000
```

### Frontend (port 3000)

```bash
npm run dev
```

### Health Check

```bash
curl http://localhost:5000/health
```

## API Endpoints

All Express routes are prefixed with `/api` on port 5000.

### Auth
| Method | Route | Description |
|---|---|---|
| POST | `/auth/signup` | Register new user |
| POST | `/auth/login` | Login, returns JWT |

### News & Crawling
| Method | Route | Description |
|---|---|---|
| GET | `/news/latest` | Fetch articles (filterable by keyword, sentiment, credibility, date, page) |
| POST | `/news/search` | Search Google News by keyword |
| POST | `/crawl` | Manually trigger crawl |

### Analysis
| Method | Route | Description |
|---|---|---|
| POST | `/analyze` | Summarize + sentiment for one article |
| POST | `/analyze/batch` | Batch sentiment pipeline |
| GET | `/analyze/status` | `{ total, analyzed, unanalyzed }` |

### Semantic Search
| Method | Route | Description |
|---|---|---|
| POST | `/semantic-search` | Vector similarity search by query |
| GET | `/similar/:id` | Top 5 similar articles |
| POST | `/embed/run` | Manually trigger embedding pipeline |

### Credibility (Fake News Detection)
| Method | Route | Description |
|---|---|---|
| GET | `/credibility/status` | `{ total, credible, suspicious, likely_fake }` |
| POST | `/credibility/run` | Manually trigger credibility pipeline |

### Topic Modeling
| Method | Route | Description |
|---|---|---|
| GET | `/topics/status` | Clustering stats + distribution |
| GET | `/topics/distribution` | Per-topic sentiment breakdown (`?days=7\|30\|90\|365`) |
| POST | `/topics/run` | Manually trigger topic pipeline |

### Stance Analysis
| Method | Route | Description |
|---|---|---|
| GET | `/stance/status` | `{ total, scored, unscored, distribution[] }` |
| POST | `/stance/run` | Manually trigger stance pipeline |

### Trends
| Method | Route | Description |
|---|---|---|
| GET | `/trends` | Daily article volume + 7-day Groq forecast |

### Keyword Watchlist
| Method | Route | Description |
|---|---|---|
| GET | `/watchlist` | List watched keywords |
| POST | `/watchlist` | Add keyword |
| DELETE | `/watchlist/:id` | Remove keyword |
| PATCH | `/watchlist/:id/toggle` | Enable / disable keyword |

### Reports
| Method | Route | Description |
|---|---|---|
| GET | `/reports` | List generated reports |
| POST | `/reports/generate` | Manually generate report |

### Conversations (AI Chat)
| Method | Route | Description |
|---|---|---|
| POST | `/conversation` | Multi-turn chat with Groq + Tavily search |
| GET | `/conversations` | List conversations |

### LINE Bot
| Method | Route | Description |
|---|---|---|
| POST | `/line/webhook` | LINE messaging webhook |

**LINE Bot commands:** `搜尋 <keyword>`, `報告`, `狀態`, `幫助` — anything else triggers a Groq reply in Traditional Chinese.

## Features

### Post-Crawl AI Pipeline

After each crawl cycle, pipelines fire automatically in sequence:

| Delay | Pipeline |
|---|---|
| 0s | Sentiment analysis |
| 15s | Semantic embedding |
| 30s | Keyword suggestions |
| 45s | Credibility scoring (credible / suspicious / likely_fake) |
| 60s | Topic classification (10 fixed Chinese topic labels) |
| 75s | Stance analysis (支持 / 反對 / 中立) |

Weekly reports are generated every Monday at 8:00am via cron (`0 8 * * 1`).

### Dashboard Layout

Header → Status cards → Keyword frequency + Sentiment breakdown → Keyword Watchlist → Sentiment Heatmap (12-week) → Topic Modeling → Stance Analysis → Trend Prediction → Reports → Article list

### Topic Labels (Fixed Set)

`科技產業` · `政治選舉` · `經濟金融` · `國際關係` · `社會民生` · `環境氣候` · `健康醫療` · `娛樂文化` · `軍事安全` · `教育學術`

## Troubleshooting

**`GROQ_API_KEY is required`**
Make sure `backend/.env` exists and the key is set.

**MongoDB connection failed**
Check `MONGODB_URI` in `.env` and verify your Atlas IP whitelist.

**Module not found**
Run `npm install` in both the root directory and `backend/`. There are two separate dependency trees.

**LINE Bot not receiving messages**
Confirm `LINE_CHANNEL_SECRET` and `LINE_CHANNEL_ACCESS_TOKEN` are set in `backend/.env` and that the webhook URL is registered in the LINE Developer Console.

## Roadmap

- [ ] Dcard crawler
- [ ] YouTube API data collection
- [ ] Daily report schedule (currently weekly only)
- [ ] Alert / notification system (LINE push on sentiment spikes)