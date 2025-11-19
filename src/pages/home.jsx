"use client";
import AticleCard from "@/components/ArticleCard";
import SummaryBox from "@/components/SummaryBox";
import { useState } from "react";

export default function Home() {
  const [article, setArticle] = useState("");
  const [summary, setSummary] = useState("");
  const [comparison, setComparison] = useState(null);

  const handleSumamrize = async () => {
    const res = await fetch("/api/summarize", {
      method: "POST",
      headers: { "contect-type": "application/json" },
      body: JSON.stringify({ text: article }),
    });
    const data = await res.json();
    setSummary(data.summary);
  };

  return (
    <>
      <div className="space-y-6">
        <textarea
          className="w-full h-40 p-4 rounded-lg bg-gret-800/50 backdrop-blur-md"
          placeholder="Paste your article here..."
          value={article}
          onChange={(e) => setArticle(e.target.value)}
        />
        <div className="flex-gap-4">
          <button
            onClick={handleSumamrize}
            className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
          >
            Summarize
          </button>
        </div>
        {summary && <SummaryBox summary={summary} />}
      </div>
    </>
  );
}
