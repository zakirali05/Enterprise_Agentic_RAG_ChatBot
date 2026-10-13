"use client";

import React from "react";
import { Sparkles, Plus, PanelLeft, Pin } from "lucide-react";

interface HeaderProps {
  onNewChat: () => void;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
  isSidebarPinned?: boolean;
}

export default function Header({
  onNewChat,
  onToggleSidebar,
  isSidebarOpen = false,
  isSidebarPinned = false,
}: HeaderProps) {
  return (
    <header className="h-16 border-b border-white/10 sticky top-0 z-30 px-3 md:px-6 flex items-center justify-between bg-[#090D16]/95 backdrop-blur-md">
      {/* Brand & Identity */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Mobile / Screen Sidebar Toggle Button */}
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className={`md:hidden p-2 rounded-xl border transition-all active:scale-95 cursor-pointer flex items-center gap-1 ${
              isSidebarOpen
                ? "bg-indigo-600/20 border-indigo-500/40 text-indigo-300"
                : "bg-slate-900/60 hover:bg-slate-800 border-white/10 text-slate-300 hover:text-white"
            }`}
            title={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
            aria-label="Toggle sidebar"
          >
            <PanelLeft className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400 " />
            {isSidebarPinned && (
              <Pin className="w-3 h-3 text-cyan-400 rotate-45 -ml-0.5" />
            )}
          </button>
        )}

        <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-sm sm:text-base md:text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Enterprise Copilot
            </h1>
            <span className="text-[9px] sm:text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Agentic RAG
            </span>
          </div>
          <p className="text-xs text-slate-400 hidden sm:block">
            Powered by Langchain, LangGraph, QdrantDB, Redis, FastAPI, PostgreSQL, Supabase
          </p>
        </div>
      </div>

      {/* Right Controls */}
      
    </header>
  );
}
