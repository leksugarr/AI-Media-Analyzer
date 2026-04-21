"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ArticleCard from "@/components/ArticleCard";
import { useAuth } from "@/context/AuthContext";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Legend,
  Tooltip,
} from "chart.js";

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Legend, Tooltip);

export default function TopicChatbot() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: { reply: "Hi! Ask me about any real-world topic — I'll analyze it with current information." },
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const { token } = useAuth();
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg = { role: "user", content: input };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      // kirim hanya role+content string ke backend
      const payload = updatedMessages.map((m) => ({
        role: m.role,
        content: typeof m.content === "string"
          ? m.content
          : m.content.reply || JSON.stringify(m.content),
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messages: payload }),
      });

      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: { reply: "Something went wrong. Please try again." } },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <ArticleCard className="flex flex-col gap-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider">Topic Chatbot</p>

      {/* Chat messages */}
      <div className="flex flex-col gap-4 max-h-[500px] overflow-y-auto pr-1">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] space-y-3 ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col`}>

              {/* Bubble */}
              <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-blue-600/30 border border-blue-500/30 text-white rounded-tr-sm"
                  : "bg-white/5 border border-white/10 text-gray-200 rounded-tl-sm"
              }`}>
                {typeof msg.content === "string" ? msg.content : msg.content.reply}
              </div>

              {/* Classification badges */}
              {msg.content?.category && (
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-purple-600/20 border border-purple-500/30 rounded-full text-xs text-purple-300">
                    {msg.content.category}
                  </span>
                  {msg.content.subtopics?.map((s, j) => (
                    <span key={j} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-gray-400">
                      {s}
                    </span>
                  ))}
                </div>
              )}

              {/* Trend chart */}
              {msg.content?.trend_labels && (
                <div className="w-full bg-white/5 border border-white/10 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-2">Trend over time</p>
                  <Line
                    data={{
                      labels: msg.content.trend_labels,
                      datasets: [
                        {
                          label: "Positive",
                          data: msg.content.trend_positive,
                          borderColor: "#4ade80",
                          backgroundColor: "rgba(74,222,128,0.08)",
                          tension: 0.4,
                          pointRadius: 3,
                        },
                        {
                          label: "Negative",
                          data: msg.content.trend_negative,
                          borderColor: "#f87171",
                          backgroundColor: "rgba(248,113,113,0.06)",
                          tension: 0.4,
                          pointRadius: 3,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      plugins: { legend: { labels: { color: "#9ca3af", font: { size: 11 } } } },
                      scales: {
                        x: { ticks: { color: "#6b7280", font: { size: 10 } }, grid: { color: "rgba(255,255,255,0.05)" } },
                        y: { min: 0, max: 100, ticks: { color: "#6b7280", font: { size: 10 }, callback: (v) => v + "%" }, grid: { color: "rgba(255,255,255,0.05)" } },
                      },
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="flex justify-start">
            <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm">
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-gray-400"
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 pt-2 border-t border-white/10">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about any topic..."
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500/50 transition placeholder-gray-600"
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="px-4 py-2.5 bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/30 rounded-xl text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </div>
    </ArticleCard>
  );
}