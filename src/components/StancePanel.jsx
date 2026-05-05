"use client";
import { useState, useEffect } from "react";

const LABEL_STYLE = {
  "支持": "text-green-400 border-green-500/30 bg-green-500/10",
  "反對": "text-red-400 border-red-500/30 bg-red-500/10",
  "中立": "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
};

export default function StancePanel() {
  const [data, setData]       = useState(null);
  const [running, setRunning] = useState(false);
  const [msg, setMsg]         = useState("");

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/stance");
      setData(await res.json());
    } catch {}
  };

  useEffect(() => { fetchStatus(); }, []);

  const handleRun = async () => {
    setRunning(true); setMsg("");
    try {
      const res  = await fetch("/api/stance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 50 }) });
      const json = await res.json();
      setMsg(json.message || "Started");
      setTimeout(fetchStatus, 3000);
    } catch { setMsg("Failed"); }
    setRunning(false);
  };

  const total = data?.distribution?.reduce((s, d) => s + d.count, 0) || 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider">Stance Analysis</p>
          {data && (
            <p className="text-[10px] text-gray-600 mt-0.5">
              {data.scored} / {data.total} articles scored · {data.unscored} pending
            </p>
          )}
        </div>
        <button
          onClick={handleRun}
          disabled={running}
          className="text-[10px] px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 rounded-lg transition disabled:opacity-40"
        >
          {running ? "Running..." : "▶ Run"}
        </button>
      </div>

      {msg && <p className="text-[10px] text-green-400">{msg}</p>}

      {data?.distribution?.length > 0 ? (
        <div className="flex flex-col gap-2">
          {data.distribution.map(({ label, count }) => {
            const pct = Math.round((count / total) * 100);
            return (
              <div key={label} className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${LABEL_STYLE[label] || "text-gray-400 border-white/10"}`}>
                    {label}
                  </span>
                  <span className="text-[10px] text-gray-500">{count} articles ({pct}%)</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      label === "支持" ? "bg-green-500/50" :
                      label === "反對" ? "bg-red-500/50" : "bg-yellow-500/50"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-gray-600 text-center py-6">
          {data ? "No stance data yet — click Run to start" : "Loading..."}
        </p>
      )}
    </div>
  );
}