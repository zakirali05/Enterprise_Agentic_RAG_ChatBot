"use client";

import React, { useState } from "react";
import {
  X,
  FileText,
  Globe,
  ExternalLink,
  Copy,
  Check,
  Percent,
  Layers,
} from "lucide-react";
import { Citation } from "@/lib/types";

interface CitationsDrawerProps {
  citations: Citation[];
  isOpen: boolean;
  onClose: () => void;
  selectedCitationId?: number | null;
}

export default function CitationsDrawer({
  citations,
  isOpen,
  onClose,
  selectedCitationId,
}: CitationsDrawerProps) {
  const [copiedId, setCopiedId] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleCopy = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-slate-950 border-l border-white/10 h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-slate-100">
                Verified Enterprise Sources
              </h3>
              <p className="text-xs text-slate-400">
                {citations.length} authoritative chunks referenced
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Citations List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {citations.map((c) => {
            const isSelected = selectedCitationId === c.id;
            const scorePercent = Math.round(c.score * 100);

            return (
              <div
                key={c.id}
                id={`citation-${c.id}`}
                className={`p-3.5 rounded-xl border transition-all ${
                  isSelected
                    ? "bg-indigo-950/40 border-indigo-500 shadow-lg shadow-indigo-500/10"
                    : "bg-slate-900/40 border-white/10 hover:border-white/20"
                }`}
              >
                {/* Top Citation Meta */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-md bg-indigo-500/20 text-indigo-300 text-[11px] font-bold font-mono">
                      #{c.id}
                    </span>
                    <span className="font-medium text-xs text-slate-200 line-clamp-1">
                      {c.title}
                    </span>
                  </div>

                  {/* Similarity Score Pill */}
                  <div
                    className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 font-mono border border-cyan-500/20"
                    title="Semantic cosine similarity match score"
                  >
                    <span>{scorePercent}% match</span>
                  </div>
                </div>

                {/* Sub Metadata (Page & Category) */}
                <div className="flex items-center gap-2 mb-2.5 text-[11px] text-slate-400">
                  <span className="px-2 py-0.5 rounded bg-white/5">
                    {c.category}
                  </span>
                  {c.page && <span>Page {c.page}</span>}
                  {c.source.startsWith("http") && (
                    <a
                      href={c.source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:underline flex items-center gap-0.5"
                    >
                      <span>Web Link</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>

                {/* Snippet text */}
                <div className="p-2.5 rounded-lg bg-black/40 text-xs text-slate-300 font-mono leading-relaxed border border-white/5 whitespace-pre-wrap">
                  {c.snippet}
                </div>

                {/* Actions */}
                <div className="mt-2.5 flex justify-end">
                  <button
                    onClick={() => handleCopy(c.id, c.snippet)}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-indigo-300 transition-colors"
                  >
                    {copiedId === c.id ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied snippet</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Chunk</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
