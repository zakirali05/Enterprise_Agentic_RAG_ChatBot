"use client";

import React, { useState, useEffect } from "react";
import { Brain, Sparkles, ChevronDown, ChevronUp, Cpu, Compass } from "lucide-react";
import { TraceStep } from "@/lib/types";

interface ClaudeThinkingBlockProps {
  traces?: TraceStep[];
  isStreaming: boolean;
  hasTokens: boolean;
}

export default function ClaudeThinkingBlock({
  traces = [],
  isStreaming,
  hasTokens,
}: ClaudeThinkingBlockProps) {
  const [dotCount, setDotCount] = useState(1);
  const [isExpanded, setIsExpanded] = useState(false);
  const [duration, setDuration] = useState(0);

  // Dynamic typing loop for the dots: 1 -> 2 -> 3 -> 1
  useEffect(() => {
    if (!isStreaming) return;
    const interval = setInterval(() => {
      setDotCount((prev) => (prev % 3) + 1);
    }, 400);
    return () => clearInterval(interval);
  }, [isStreaming]);

  // Duration timer in seconds
  useEffect(() => {
    if (!isStreaming) return;
    const start = Date.now();
    const timer = setInterval(() => {
      setDuration(Math.max(1, Math.round((Date.now() - start) / 1000)));
    }, 500);
    return () => clearInterval(timer);
  }, [isStreaming]);

  // Derive active thought step from live traces
  const getThinkingLabel = () => {
    if (!traces || traces.length === 0) return "Thinking";
    const active = traces.find((t) => t.status === "running") || traces[traces.length - 1];
    if (!active) return "Thinking";

    switch (active.step) {
      case "router":
        return "Reasoning query intent & routing";
      case "retriever":
        return "Searching enterprise knowledge vector base";
      case "grader":
        return "Reasoning & grading document relevance";
      case "web_search":
        return "Querying verified web sources";
      case "generator":
        return "Reasoning & formulating synthesis";
      default:
        return active.title || "Thinking";
    }
  };

  const label = getThinkingLabel();
  const dotsText = ".".repeat(dotCount);

  // If already finished and has content, show a subtle collapsed "Thought for Xs" badge
  if (!isStreaming && hasTokens) {
    return (
      <div className="my-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/60 hover:bg-slate-800/80 border border-white/5 text-[11px] text-slate-400 hover:text-slate-300 transition-colors cursor-pointer group"
        >
          <Brain className="w-3.5 h-3.5 text-indigo-400 group-hover:text-indigo-300 transition-colors" />
          <span>Thought for {duration || 2}s</span>
          {isExpanded ? (
            <ChevronUp className="w-3 h-3 text-slate-500" />
          ) : (
            <ChevronDown className="w-3 h-3 text-slate-500" />
          )}
        </button>

        {isExpanded && traces.length > 0 && (
          <div className="mt-2 p-3 rounded-xl bg-slate-950/80 border border-white/10 text-xs font-mono space-y-1.5 text-slate-400 animate-in fade-in duration-200">
            {traces.map((t, idx) => (
              <div key={idx} className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span className="text-slate-300">{t.title}</span>
                </span>
                <span className="text-slate-500">{t.details}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Active Streaming State (Claude 3.7 Style Thinking Banner)
  return (
    <div className="my-3 rounded-xl border border-indigo-500/20 bg-gradient-to-r from-indigo-950/30 via-slate-900/40 to-slate-950/30 p-3.5 space-y-3 relative overflow-hidden backdrop-blur-sm">
      {/* Background Animated Shimmer Glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-500/5 to-transparent animate-[shimmer_2.5s_infinite] pointer-events-none" />

      {/* Header status bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Animated Brain with pulsing ring */}
          <div className="relative flex items-center justify-center">
            <span className="absolute w-5 h-5 rounded-full bg-indigo-500/20 animate-ping opacity-75" />
            <div className="w-5 h-5 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300">
              <Brain className="w-3.5 h-3.5 animate-pulse" />
            </div>
          </div>

          {/* Thinking label with loop typed dots */}
          <div className="flex items-center text-xs font-medium text-indigo-200">
            <span>{label}</span>
            <span className="w-6 font-mono text-cyan-400 font-bold tracking-widest text-left">
              {dotsText}
            </span>
          </div>
        </div>

        {/* Right badge: duration */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
            {duration}s
          </span>
          {traces.length > 0 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-slate-500 hover:text-slate-300 transition-colors p-0.5"
              title="Toggle trace details"
            >
              {isExpanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Expanded Traces View if toggled */}
      {isExpanded && traces.length > 0 && (
        <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 space-y-1.5 text-[11px] font-mono text-slate-400">
          {traces.map((t, idx) => (
            <div key={idx} className="flex items-center justify-between">
              <span className="text-slate-300">• {t.title}</span>
              <span className="text-cyan-400/80 text-[10px]">{t.status}</span>
            </div>
          ))}
        </div>
      )}

      {/* Claude-style Response Placeholder Skeleton Lines (Only before tokens appear) */}
      {!hasTokens && (
        <div className="space-y-2 pt-1 animate-pulse">
          <div className="h-2.5 bg-gradient-to-r from-slate-800 via-indigo-900/40 to-slate-800 rounded-full w-5/6" />
          <div className="h-2.5 bg-gradient-to-r from-slate-800 via-indigo-900/30 to-slate-800 rounded-full w-4/6" />
          <div className="h-2.5 bg-gradient-to-r from-slate-800 via-indigo-900/20 to-slate-800 rounded-full w-3/6" />
        </div>
      )}
    </div>
  );
}
