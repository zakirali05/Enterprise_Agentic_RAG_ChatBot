"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Square,
  Paperclip,
  Sparkles,
  Database,
  Globe,
} from "lucide-react";
import { AgentMode } from "@/lib/types";

interface ChatInputProps {
  onSendMessage: (query: string) => void;
  isLoading: boolean;
  onStop: () => void;
  mode: AgentMode;
  onModeChange: (m: AgentMode) => void;
  onOpenKnowledgeModal: () => void;
}

export default function ChatInput({
  onSendMessage,
  isLoading,
  onStop,
  mode,
  onModeChange,
  onOpenKnowledgeModal,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        180
      )}px`;
    }
  }, [input]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="p-4 md:p-6 bg-gradient-to-t from-[#090d16] via-[#090d16]/95 to-transparent">
      <div className="max-w-4xl mx-auto">
        <form
          onSubmit={handleSubmit}
          className="relative rounded-2xl glass-panel p-2.5 shadow-2xl focus-within:border-indigo-500/60 focus-within:shadow-indigo-500/10 transition-all space-y-1.5"
        >
          {/* Top Bar: Interactive Mode Selectors (CRAG, Docs Only, Web) & Model Info */}
          <div className="px-1 pt-0.5 pb-1 flex flex-wrap items-center justify-between gap-2 border-b border-white/5 text-xs">
            {/* Mode Selectors */}
            <div className="flex items-center p-1 rounded-xl bg-slate-900/90 border border-white/10 text-xs font-medium gap-1">
              <button
                type="button"
                onClick={() => onModeChange("auto")}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  mode === "auto"
                    ? "bg-indigo-600 text-white shadow-sm font-semibold"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
                title="Intelligent routing with Corrective RAG (CRAG) & Web Fallback"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                <span>Auto CRAG</span>
              </button>

              <button
                type="button"
                onClick={() => onModeChange("rag")}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  mode === "rag"
                    ? "bg-indigo-600 text-white shadow-sm font-semibold"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
                title="Strict Internal Documents Knowledge Base RAG"
              >
                <Database className="w-3.5 h-3.5" />
                <span>Docs Only</span>
              </button>

              <button
                type="button"
                onClick={() => onModeChange("web")}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  mode === "web"
                    ? "bg-indigo-600 text-white shadow-sm font-semibold"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
                title="Real-time Web Search via DuckDuckGo"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Web</span>
              </button>
            </div>

            {/* Model Tag */}
            <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-400 font-mono px-2">
              <span className="text-cyan-400 font-semibold">Groq LPU (qwen3.8-27b)</span>
              <span>•</span>
              <span className="text-indigo-400">Qdrant Cloud</span>
            </div>
          </div>

          {/* Text Area */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={
              mode === "rag"
                ? "Ask strictly across internal enterprise knowledge base documents..."
                : mode === "web"
                ? "Search the live web for real-time information..."
                : "Ask any question (Auto CRAG will evaluate docs and web fallback)..."
            }
            className="w-full bg-transparent px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none resize-none max-h-44 leading-relaxed"
          />

          {/* Bottom Bar: Action buttons & Send */}
          <div className="flex items-center justify-between pt-1 px-1">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onOpenKnowledgeModal}
                className="p-2 rounded-xl text-slate-400 hover:text-cyan-300 hover:bg-slate-800/60 transition-colors flex items-center gap-1.5 text-xs cursor-pointer"
                title="Manage Knowledge Base Documents"
              >
                <Paperclip className="w-4 h-4" />
                <span className="hidden sm:inline text-[11px]">Knowledge Base</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 hidden sm:inline">
                Shift + Enter for new line
              </span>

              {isLoading ? (
                <button
                  type="button"
                  onClick={onStop}
                  className="p-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md shadow-rose-600/20 active:scale-95 cursor-pointer"
                  title="Stop generation"
                >
                  <Square className="w-4 h-4 fill-white" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="p-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:opacity-95 disabled:opacity-40 disabled:hover:opacity-40 text-white transition-all shadow-md shadow-indigo-600/20 active:scale-95 cursor-pointer"
                  title="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
