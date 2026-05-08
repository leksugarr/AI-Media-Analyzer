"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import ArticleCard from "@/components/ArticleCard";
import { useAuth } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";

function Heatmap({ data }) {
 // guard — kalau data tidak lengkap, jangan render
  if (!data?.years || !data?.months || !data?.data) return null;
  const { years, months, data: grid } = data;
  if (!Array.isArray(grid) || grid.length === 0) return null;

  const max = Math.max(...grid.flat()) || 1; // hindari division by zero

  const getColor = (val) => {
    const intensity = val / max;
    if (intensity < 0.2) return "rgba(99,102,241,0.1)";
    if (intensity < 0.4) return "rgba(99,102,241,0.25)";
    if (intensity < 0.6) return "rgba(99,102,241,0.45)";
    if (intensity < 0.8) return "rgba(99,102,241,0.65)";
    return "rgba(99,102,241,0.9)";
  };

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[500px]">
        {/* Month labels */}
        <div className="flex ml-10 mb-1">
          {months.map(m => (
            <div key={m} className="flex-1 text-center text-[9px] text-gray-600">{m}</div>
          ))}
        </div>
        {/* Rows per year */}
        {years.map((year, yi) => (
          <div key={year} className="flex items-center gap-1 mb-1">
            <div className="w-9 text-[10px] text-gray-500 text-right pr-1">{year}</div>
            {Array.isArray(grid[yi]) && grid[yi].map((val, mi) => (
              <div
                key={mi}
                className="flex-1 h-5 rounded-sm cursor-default transition-all hover:scale-110"
                style={{ background: getColor(val) }}
                title={`${months[mi]} ${year}: ${val}`}
              />
            ))}
          </div>
        ))}
        {/* Legend */}
        <div className="flex items-center gap-2 mt-2 ml-10">
          <span className="text-[9px] text-gray-600">Low</span>
          {[0.1, 0.25, 0.45, 0.65, 0.9].map((op, i) => (
            <div key={i} className="w-4 h-3 rounded-sm" style={{ background: `rgba(99,102,241,${op})` }} />
          ))}
          <span className="text-[9px] text-gray-600">High</span>
        </div>
      </div>
    </div>
  );
}



export default function HomePage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(null);


const { user, token, loading: authLoading } = useAuth();
const router = useRouter();
const bottomRef = useRef(null);
const t = useTranslations("home");
const locale = useLocale();

  // Redirect to login if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
router.push(`/${locale}/login`);
    }
  }, [user, authLoading, router]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (token) fetchConversations();
  }, [token]);

  const fetchConversations = async () => {
    try {
      const res = await fetch("/api/chat", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch {}
  };

  const loadConversation = async (id) => {
    try {
      const res = await fetch(`/api/chat?id=${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setMessages(data.conversation.messages || []);
      setConversationId(id);
      setShowHistory(false);
    } catch {}
  };

  const startNewChat = () => {
    setMessages([]);
    setConversationId(null);
  };

 const handleSend = async (overrideText) => {
  const text = typeof overrideText === "string" ? overrideText : input;
  if (!text.trim() || loading) return;
  setError("");

  const userMsg = { role: "user", content: text };  // ← pakai text, bukan input
  const updatedMessages = [...messages, userMsg];
  setMessages(updatedMessages);
  setInput("");  // clear input box
  setLoading(true);
    try {
      const payload = updatedMessages.map(m => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content : m.content?.reply || JSON.stringify(m.content),
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messages: payload, conversationId }),
      });

      const result = await res.json();
      if (!res.ok) { setError(result.error || "Something went wrong"); return; }

      setMessages(prev => [...prev, { role: "assistant", content: result.data }]);
      if (result.conversationId) {
        setConversationId(result.conversationId);
        fetchConversations();
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen pt-28 pb-20 px-6">
      <div className="max-w-4xl mx-auto flex gap-4">

        {/* Sidebar history */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="w-52 flex-shrink-0"
            >
              <ArticleCard className="p-3 flex flex-col gap-2 h-full">
                <div className="flex justify-between items-center">
<p className="text-xs text-gray-500 uppercase tracking-wider">{t("conversations")}</p>
<button onClick={startNewChat} className="text-xs text-blue-400 hover:text-blue-300">{t("newChat")}</button>
                </div>
                <div className="flex flex-col gap-1 overflow-y-auto max-h-[500px]">
                  {conversations.length === 0 ? (
<p className="text-xs text-gray-600 text-center py-4">{t("noConversations")}</p>
                  ) : conversations.map(c => (
                    <button key={c._id} onClick={() => loadConversation(c._id)}
                      className={`text-left px-3 py-2 rounded-xl text-xs hover:bg-white/10 transition ${conversationId === c._id ? "bg-white/10 text-white" : "text-gray-400"}`}>
                      <p className="truncate font-medium">{c.title}</p>
                      <p className="text-gray-600 mt-0.5">{new Date(c.updatedAt).toLocaleDateString()}</p>
                    </button>
                  ))}
                </div>
              </ArticleCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main */}
        <div className="flex-1 flex flex-col gap-4">

          {/* Header */}
          <div className="text-center space-y-1">
      <h1 className="text-4xl font-bold">{t("title")}</h1>
      <p className="text-gray-400 text-sm">{t("subtitle")}</p>
            <p className="text-xs text-gray-500">{user.email}</p>
          </div>

          {/* Messages */}
          <ArticleCard className="flex flex-col gap-4 min-h-[400px] max-h-[600px] overflow-y-auto">
            {messages.length === 0 && (
              <div className="flex-1 flex items-center justify-center py-16">
<p className="text-gray-600 text-sm">{t("emptyChat")}</p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[85%] flex flex-col gap-3">

                  {/* Bubble */}
                  <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-blue-600/30 border border-blue-500/30 text-white rounded-tr-sm"
                      : "bg-white/5 border border-white/10 text-gray-200 rounded-tl-sm"
                  }`}>
                    {typeof msg.content === "string" ? msg.content : msg.content?.reply}
                  </div>

                  {/* Full analysis — hanya muncul kalau ada category */}
                  {msg.content?.category && (
                    <div className="flex flex-col gap-3 w-full">

                      {/* Category + subtopics */}
                      <div className="flex flex-wrap gap-2">
                        <span className="px-3 py-1 bg-purple-600/20 border border-purple-500/30 rounded-full text-xs text-purple-300 font-medium">
                          {msg.content.category}
                        </span>
                       {msg.content.subtopics?.map((s, j) => (
  <button
    key={j}
    onClick={() => {
      setInput(s);
      handleSend(s);
    }}
    className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-gray-400 hover:bg-white/15 hover:text-white hover:border-white/30 transition cursor-pointer"
  >
    {s}
  </button>
))}
                      </div>

                      {/* Sentiment */}
                      {msg.content.sentiment && (
                        <ArticleCard className="p-3 space-y-2">
<p className="text-xs text-gray-500 uppercase tracking-wider">{t("sentiment")}</p>
                          <div className="flex items-center gap-3">
                            <span className={`text-lg font-bold ${
                              msg.content.sentiment.label === "POSITIVE" ? "text-green-400" :
                              msg.content.sentiment.label === "NEGATIVE" ? "text-red-400" : "text-yellow-400"
                            }`}>{msg.content.sentiment.label}</span>
                            <span className="text-sm text-gray-400">
                              {(msg.content.sentiment.score * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div className="w-full bg-white/10 rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full transition-all ${
                              msg.content.sentiment.label === "POSITIVE" ? "bg-green-400" :
                              msg.content.sentiment.label === "NEGATIVE" ? "bg-red-400" : "bg-yellow-400"
                            }`} style={{ width: `${msg.content.sentiment.score * 100}%` }} />
                          </div>
                        </ArticleCard>
                      )}

                      {/* Heatmap */}
                      {msg.content.heatmap && (
                        <ArticleCard className="p-3">
<p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{t("intensity")}</p>
                          <Heatmap data={msg.content.heatmap} />
                        </ArticleCard>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm">
                  <div className="flex gap-1.5">
                    {[0,1,2].map(i => (
                      <motion.span key={i} className="w-1.5 h-1.5 rounded-full bg-gray-400"
                        animate={{ y: [0,-4,0] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </ArticleCard>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          {/* Input */}
          <ArticleCard className="p-3">
            <div className="flex gap-2 items-end">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
placeholder={t("placeholder")}
                rows={2}
                className="flex-1 bg-transparent outline-none text-sm resize-none leading-relaxed placeholder-gray-600"
              />
              <div className="flex flex-col gap-2 items-end flex-shrink-0">
                <button
                  onClick={() => setShowHistory(p => !p)}
                  className="text-xs text-gray-400 hover:text-white px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg transition"
                >
{showHistory ? t("hideHistory") : t("history")}
                </button>
                <button
                  onClick={() => handleSend()}
                  disabled={loading || !input.trim()}
                  className="px-4 py-1.5 bg-blue-600/40 hover:bg-blue-600/60 border border-blue-500/30 rounded-lg text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
{loading ? t("loading") : t("send")}
                </button>
              </div>
            </div>
          </ArticleCard>
        </div>
      </div>
    </div>
  );
}