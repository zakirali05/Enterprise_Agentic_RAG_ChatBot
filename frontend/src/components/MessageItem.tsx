"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Sparkles,
  User,
  Copy,
  Check,
  Layers,
  Globe,
  FileText,
  Clock,
  Terminal,
} from "lucide-react";
import { Message, Citation } from "@/lib/types";
import AgentTraceTimeline from "./AgentTraceTimeline";
import ClaudeThinkingBlock from "./ClaudeThinkingBlock";

interface MessageItemProps {
  message: Message;
  onOpenCitation: (citationId?: number) => void;
}

export default function MessageItem({
  message,
  onOpenCitation,
}: MessageItemProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasTokens = !!(message.content && message.content.trim().length > 0);

  return (
    <div
      className={`py-5 px-4 md:px-6 flex gap-3 md:gap-4 transition-colors ${
        isUser ? "bg-slate-900/20" : "bg-slate-950/40 border-y border-white/[0.04]"
      }`}
    >
      {/* Avatar */}
      <div className="shrink-0 mt-0.5">
        {isUser ? (
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-slate-700 to-slate-600 flex items-center justify-center text-white shadow-md">
            <User className="w-4 h-4" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
        )}
      </div>

      {/* Message Body */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* Header meta */}
        <div className="flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-200">
              {isUser ? "You" : "Enterprise Copilot"}
            </span>
            {!isUser && message.mode && (
              <span className="text-[10px] px-2 py-0.2 rounded-full bg-indigo-500/10 text-indigo-300 font-mono border border-indigo-500/20 uppercase">
                {message.mode}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all"
              title="Copy response"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Claude 3.7 Style Thinking & Reasoning Block with animated typing dots */}
        {!isUser && (message.isStreaming || (message.traces && message.traces.length > 0)) && (
          <ClaudeThinkingBlock
            traces={message.traces}
            isStreaming={!!message.isStreaming}
            hasTokens={hasTokens}
          />
        )}

        {/* Citation Badges (if available) */}
        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1 mr-1">
              <Layers className="w-3 h-3 text-cyan-400" />
              Sources:
            </span>
            {message.citations.map((c, cIdx) => (
              <button
                key={`cit-${c.id}-${cIdx}`}
                onClick={() => onOpenCitation(c.id)}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900/90 hover:bg-indigo-950/60 border border-white/10 hover:border-indigo-500/50 text-slate-300 hover:text-indigo-200 transition-all flex items-center gap-1.5 cursor-pointer"
                title={`Click to view snippet from ${c.title}`}
              >
                <span className="w-3.5 h-3.5 rounded bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-[9px] font-bold font-mono">
                  {c.id}
                </span>
                <span className="truncate max-w-[140px] font-medium">
                  {c.title}
                </span>
                <span className="text-[10px] text-cyan-400 font-mono">
                  {Math.round(c.score * 100)}%
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Markdown Content */}
        <div className="prose-enterprise text-sm">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              // Custom code block renderer with language header & copy button
              code({ node, className, children, ...props }: any) {
                const match = /language-(\w+)/.exec(className || "");
                const isInline = !match && !String(children).includes("\n");
                if (isInline) {
                  return (
                    <code className="text-cyan-300 bg-slate-800/80 px-1 py-0.5 rounded text-xs font-mono" {...props}>
                      {children}
                    </code>
                  );
                }
                const codeString = String(children).replace(/\n$/, "");
                return (
                  <div className="relative group my-3 rounded-xl overflow-hidden border border-white/10 bg-slate-950">
                    <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/90 border-b border-white/5 text-[11px] text-slate-400 font-mono">
                      <span>{match ? match[1] : "code"}</span>
                      <button
                        onClick={() => navigator.clipboard.writeText(codeString)}
                        className="text-slate-400 hover:text-slate-100 transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                    <pre className="p-3 text-xs overflow-x-auto text-slate-200 font-mono leading-relaxed bg-black/40">
                      <code>{codeString}</code>
                    </pre>
                  </div>
                );
              },
            }}
          >
            {message.content}
          </ReactMarkdown>

          {/* Streaming Cursor */}
          {message.isStreaming && (
            <span className="inline-block w-2 h-4 ml-1 bg-cyan-400 animate-pulse align-middle" />
          )}
        </div>
      </div>
    </div>
  );
}
