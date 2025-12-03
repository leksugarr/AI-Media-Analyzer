"use client";
import { useState } from "react";
import Navbar from "@/components/Navbar";
import ArticleCard from "@/components/ArticleCard";
import SummaryBox from "../components/SummaryBox";
import Button from "@/components/Button";

export default function HomePage() {
  const [input, setInput] = useState("");
  const [summary, setSummary] = useState("");

  const summarize = async () => {
    const res = await fetch("/api/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: input }),
    });
    const data = await res.json();
    setSummary(data.summary);
  };

  return (
    <div>
      <Navbar />
      <section className="min-h-screen pt-32 px-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <ArticleCard>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste your article here..."
              className="w-full h-48 bg-transparent outline-none text-lg resize-none"
            />
          </ArticleCard>

          <Button
            onClick={summarize}
            className="relative px-6 py-3 font-semibold group overflow-hidden rounded-xl bg-white/10 hover:bg-white/20 transition"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 blur-xl opacity-0 group-hover:opacity-40 transition"></span>
            <span className="relative z-10">Summarize</span>
          </Button>

          {summary && <SummaryBox summary={summary} />}
        </div>
      </section>
    </div>
  );
}
