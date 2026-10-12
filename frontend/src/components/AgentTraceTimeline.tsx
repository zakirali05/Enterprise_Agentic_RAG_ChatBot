"use client";

import React, { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Cpu,
  Compass,
  Search,
  Scale,
  Globe,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Terminal,
} from "lucide-react";
import { TraceStep } from "@/lib/types";

interface AgentTraceTimelineProps {
  traces: TraceStep[];
  isStreaming?: boolean;
}

export default function AgentTraceTimeline({
  traces,
  isStreaming = false,
}: AgentTraceTimelineProps) {
  const [isExpanded, setIsExpanded] = useState(isStreaming);

  if (!traces || traces.length === 0) return null;

  const getStepIcon = (step: string, status: string) => {
    if (status === "running") {
      return <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />;
    }
    if (status === "warning") {
      return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
    }
    switch (step) {
      case "router":
        return <Compass className="w-3.5 h-3.5 text-indigo-400" />;
      case "retriever":
        return <Search className="w-3.5 h-3.5 text-cyan-400" />;
      case "grader":
        return <Scale className="w-3.5 h-3.5 text-purple-400" />;
      case "web_search":
        return <Globe className="w-3.5 h-3.5 text-emerald-400" />;
      case "generator":
        return <Cpu className="w-3.5 h-3.5 text-blue-400" />;
      default:
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "running":
        return (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            Executing
          </span>
        );
      case "warning":
        return (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
            Fallback Triggered
          </span>
        );
      case "completed":
        return (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
            Verified
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="my-2.5 rounded-xl border border-white/10 bg-slate-950/60 overflow-hidden shadow-md">
      {/* Accordion Toggle Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3.5 py-2 text-xs hover:bg-white/[0.03] transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-indigo-400" />
          <span className="font-semibold text-slate-300">
            LangGraph Agent Workflow
          </span>
          <span className="text-slate-500 text-[11px]">
            ({traces.length} steps executed)
          </span>
          {isStreaming && (
            <span className="flex items-center gap-1 text-[11px] text-cyan-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              Reasoning...
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 text-slate-400 text-xs">
          <span>{isExpanded ? "Collapse" : "View Traces"}</span>
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </div>
      </button>

      {/* Expanded Step Timeline */}
      {isExpanded && (
        <div className="px-3.5 py-2.5 border-t border-white/5 space-y-2.5 bg-slate-900/30">
          {traces.map((trace, idx) => (
            <div key={idx} className="flex items-start gap-2.5 text-xs">
              <div className="mt-0.5 p-1 rounded-md bg-slate-800/80 border border-white/5 shrink-0">
                {getStepIcon(trace.step, trace.status)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-200">
                    {trace.title}
                  </span>
                  {getStatusBadge(trace.status)}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                  {trace.details}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
