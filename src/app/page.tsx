"use client";
import { useState } from "react";
import { CONTRACT_TEXT_MAX, CONTRACT_TEXT_MIN } from "@/lib/contract-limits";

interface Risk {
  clause: string;
  severity: "low" | "medium" | "high" | "critical";
  issue: string;
  suggestion: string;
}

interface Analysis {
  summary: string;
  overallRisk: string;
  risks: Risk[];
  missingClauses: string[];
  positives: string[];
}

const severityColor: Record<string, string> = {
  low: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

export default function Home() {
  const [contractText, setContractText] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function analyze() {
    if (!contractText.trim()) return;
    setLoading(true);
    setError("");
    setAnalysis(null);
    try {
      const res = await fetch("/api/analyze-contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setAnalysis(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = typeof ev.target?.result === "string" ? ev.target.result : "";
      if (text.length > CONTRACT_TEXT_MAX) {
        setContractText(text.slice(0, CONTRACT_TEXT_MAX));
        setNotice(`Only the first ${CONTRACT_TEXT_MAX.toLocaleString()} characters were loaded.`);
      } else {
        setContractText(text);
        setNotice("");
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">L</div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">LegalOps Copilot</h1>
            <p className="text-xs text-slate-500">AI-powered contract risk analysis</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Input Card */}
        <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Analyze Contract</h2>
            <p className="text-sm text-slate-500 mt-1">Paste your contract text or upload a .txt file to identify risks and get redline suggestions.</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-700">Upload file:</label>
            <input
              type="file"
              accept=".txt,.doc,.docx"
              onChange={handleFileUpload}
              className="text-sm text-slate-600 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          <textarea
            maxLength={CONTRACT_TEXT_MAX}
            placeholder="Or paste your contract text here..."
            className="w-full min-h-48 p-3 font-mono text-sm border rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={contractText}
            onChange={(e) => {
              setContractText(e.target.value);
              setNotice("");
            }}
          />
          <p className="text-xs text-slate-500">
            {contractText.trim().length.toLocaleString()} / {CONTRACT_TEXT_MAX.toLocaleString()} characters
            (minimum {CONTRACT_TEXT_MIN})
          </p>
          {notice && <p className="text-amber-700 text-sm">{notice}</p>}
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            onClick={analyze}
            disabled={loading || contractText.trim().length < CONTRACT_TEXT_MIN}
            className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Analyzing..." : "Analyze Contract"}
          </button>
        </div>

        {analysis && (
          <div className="space-y-4">
            {/* Executive Summary */}
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Executive Summary</h2>
                  <p className="text-sm text-slate-600 mt-2">{analysis.summary}</p>
                </div>
                <span className={`ml-4 shrink-0 px-3 py-1 rounded-full text-xs font-semibold uppercase ${severityColor[analysis.overallRisk]}`}>
                  {analysis.overallRisk} Risk
                </span>
              </div>
            </div>

            {/* Risk Flags */}
            {analysis.risks.length > 0 && (
              <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
                <h2 className="text-xl font-semibold text-slate-900">Risk Flags ({analysis.risks.length})</h2>
                {analysis.risks.map((risk, i) => (
                  <div key={i} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${severityColor[risk.severity]}`}>
                        {risk.severity}
                      </span>
                      <span className="text-sm font-mono text-slate-600 italic">&quot;{risk.clause}&quot;</span>
                    </div>
                    <p className="text-sm text-slate-700"><span className="font-medium">Issue:</span> {risk.issue}</p>
                    <p className="text-sm text-blue-700 bg-blue-50 rounded p-2"><span className="font-medium">Suggestion:</span> {risk.suggestion}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Missing Clauses */}
            {analysis.missingClauses.length > 0 && (
              <div className="bg-white rounded-xl border shadow-sm p-6 space-y-2">
                <h2 className="text-xl font-semibold text-slate-900">Missing Clauses</h2>
                <ul className="space-y-1">
                  {analysis.missingClauses.map((c, i) => (
                    <li key={i} className="text-sm text-slate-700 flex items-center gap-2">
                      <span className="text-red-500">•</span> {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Positives */}
            {analysis.positives.length > 0 && (
              <div className="bg-white rounded-xl border shadow-sm p-6 space-y-2">
                <h2 className="text-xl font-semibold text-slate-900">Well-Drafted Provisions</h2>
                <ul className="space-y-1">
                  {analysis.positives.map((p, i) => (
                    <li key={i} className="text-sm text-slate-700 flex items-center gap-2">
                      <span className="text-green-500">&#10003;</span> {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
