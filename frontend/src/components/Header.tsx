"use client";

import React from "react";
import { Sparkles, Plus } from "lucide-react";

interface HeaderProps {
  onNewChat: () => void;
}

export default function Header({ onNewChat }: HeaderProps) {
  return (
    <header className="h-16 border-b border-white/10 sticky top-0 z-30 px-4 md:px-6 flex items-center justify-between bg-[#090D16]">
      {/* Brand & Identity */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-base md:text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Enterprise Copilot
            </h1>
            <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Agentic RAG
            </span>
          </div>
          <p className="text-xs text-slate-400 hidden sm:block">
            Powered by Langchain, LangGraph, QdrantDB, Upstash Redis, FastAPI, PostGreSQL
          </p>
        </div>
      </div>

      {/* Right Controls: Clean New Chat Button */}
      {/* <div className="flex items-center gap-2">
        <button
          onClick={onNewChat}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-medium transition-all shadow-md shadow-indigo-600/20 active:scale-95 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Chat</span>
        </button>
      </div> */}
    </header>
  );
}
