# Sentiment_Analyzer

AI-Powered Summary & Sentiment Analyzer with real-time news crawling and sentiment analysis.

## Table of Contents

- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Backend Setup](#backend-setup)
- [Installation](#installation)
- [Environment Configuration](#environment-configuration)
- [Running the Backend](#running-the-backend)
- [API Endpoints](#api-endpoints)
- [Troubleshooting](#troubleshooting)

## Project Structure

```
Sentiment_Analyzer/
├── backend/                    # Node.js Express backend
│   ├── crawlers/              # Web scrapers
│   │   ├── googleNews.js      # Google News RSS parser
│   │   └── ptt.js             # PTT forum crawler
│   ├── config.js              # Configuration management
│   ├── db.js                  # MongoDB schemas and connections
│   ├── server.js              # Express server entry point
│   ├── routes.js              # API routes
│   ├── middleware.js          # Custom middleware
│   ├── crawler.js             # Scheduler for auto-crawling
│   ├── .env                   # Environment variables
│   └── package.json           # Backend dependencies
├── src/                        # Frontend React/Next.js code
│   ├── app/                   # Next.js app directory
│   ├── components/            # React components
│   └── context/               # React context
└── README.md                  # This file
```

## Prerequisites

- **Node.js** v18+ 
- **MongoDB** (Atlas recommended)
- **API Keys:**
  - [GROQ API Key](https://console.groq.com) - For AI summarization & sentiment analysis
  - [TAVILY API Key](https://tavily.com) - For real-time web search (optional)

## Backend Setup

### Installation

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

### Dependencies Installed

The backend requires these packages:

- **Express.js** (v5.1.0) - Web framework
- **Mongoose** (v8.0.0) - MongoDB ODM
- **Groq SDK** (v0.7.0) - AI/LLM integration for summarization & sentiment
- **CORS** (v2.8.5) - Cross-origin resource sharing
- **dotenv** (v17.2.3) - Environment variables
- **bcryptjs** (v2.4.3) - Password hashing for authentication
- **jsonwebtoken** (v9.0.0) - JWT authentication
- **node-fetch** (v3.3.2) - HTTP client
- **cheerio** (v1.0.0) - HTML parsing
- **node-cron** (v3.0.3) - Task scheduling
- **tavily** (v0.2.0) - Web search API client

## Environment Configuration

Create a `.env` file in the `backend/` directory with the following variables:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database_name?appName=Cluster-1

# API Keys
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxx
TAVILY_API_KEY=tvly-xxxxxxxxxxxxxxxxxxxxxx

# Scheduler
NEWS_CRON_SCHEDULE=0 */2 * * *

# CORS
CORS_ORIGIN=http://localhost:3000
```

### Getting API Keys

1. **GROQ API Key:**
   - Visit [https://console.groq.com](https://console.groq.com)
   - Sign up or log in
   - Create an API key
   - Copy and paste into `.env`

2. **TAVILY API Key (Optional):**
   - Visit [https://tavily.com](https://tavily.com)
   - Sign up for developer access
   - Get your API key
   - Copy and paste into `.env`

3. **MongoDB Connection String:**
   - Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   - Get the connection string from the Cluster > Connect > Drivers section
   - Replace `<password>` and `<database>` in the connection string

## Running the Backend

### Development Mode

Start the backend server:

```bash
npm run dev
```

Expected output:
```
✅ MongoDB connected successfully
✅ Database connected
[Scheduler] News crawler scheduled: "0 */2 * * *"
Backend running on http://localhost:5000
```

### Health Check

Test if the backend is running:

```bash
curl http://localhost:5000/health
```

Response:
```json
{
  "status": "ok",
  "environment": "development",
  "timestamp": "2026-05-04T08:42:37.999Z"
}
```

## API Endpoints

### News Search

**POST /api/news/keywords**
- Search news by keywords
- Body: `{ keywords: string[], locale?: string, limit?: number, save?: boolean }`
- Returns: Array of articles

**POST /api/news/topic**
- Search news by topic (topStories, technology, business, etc.)
- Body: `{ topic?: string, locale?: string, limit?: number, save?: boolean }`
- Returns: Array of articles

### Analysis

**POST /api/analyze/sentiment**
- Analyze sentiment of text
- Body: `{ text: string }`
- Returns: Sentiment score and label

**POST /api/analyze/summarize**
- Summarize long text
- Body: `{ text: string, length?: "short" | "medium" | "long" }`
- Returns: Summarized text

### Authentication

**POST /api/auth/signup**
- Register new user
- Body: `{ email: string, password: string }`

**POST /api/auth/login**
- Login user
- Body: `{ email: string, password: string }`
- Returns: JWT token

### Chat

**POST /api/chat**
- Chat with AI assistant
- Body: `{ messages: Array<{role: string, content: string}> }`
- Returns: AI response

## Scheduler

The backend includes an auto-crawling scheduler that:

- **Runs every 2 hours** (configurable via `NEWS_CRON_SCHEDULE` env var)
- Fetches articles from Google News
- Stores articles in MongoDB
- Avoids duplicates via URL index

Cron expression format: `"0 */2 * * *"`
- `"0 * * * *"` → every hour
- `"0 */2 * * *"` → every 2 hours (default)
- `"0 8 * * *"` → every day at 8am

## Troubleshooting

### Backend Won't Start

**Error: "GROQ_API_KEY is required"**
- Make sure `.env` file exists in `backend/` directory
- Verify `GROQ_API_KEY` is set and not empty
- Run `npm run dev` again

**Error: "MongoDB connection failed"**
- Check your `MONGODB_URI` in `.env`
- Ensure MongoDB Atlas cluster is active
- Verify IP whitelist allows your connection

**Error: "Module not found"**
- Run `npm install` to install all dependencies
- Delete `node_modules` and `package-lock.json`, then run `npm install` again

### News Crawler Not Working

- Check browser console and backend logs
- Ensure `NEWS_CRON_SCHEDULE` is a valid cron expression
- Verify Google News URL is accessible from your network

## Development Notes

### Fixed Issues (May 4, 2026)

1. **Missing Dependencies** - Added 7 required packages
2. **Invalid Tavily Package** - Fixed `@tavily/core` → `tavily` in package.json
3. **Syntax Errors** - Removed problematic Unicode characters in comments
4. **Missing googleNews.js** - Created RSS parser for Google News integration
5. **Tavily Integration** - Temporarily commented out due to API compatibility

### Key Features

- ✅ Real-time news crawling from Google News RSS feeds
- ✅ Sentiment analysis using GROQ LLM
- ✅ Article summarization with adjustable length
- ✅ MongoDB persistence with duplicate detection
- ✅ JWT authentication
- ✅ CORS-enabled for frontend integration
- ✅ Scheduled auto-crawling via node-cron
