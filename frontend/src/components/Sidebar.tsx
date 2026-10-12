"use client";

import React from "react";
import {
  MessageSquare,
  Plus,
  Trash2,
  Database,
  Shield,
  Layers,
  ChevronRight,
  HardDrive,
  Cpu,
  FileText,
  Activity,
} from "lucide-react";
import { Session, KnowledgeStats } from "@/lib/types";

interface SidebarProps {
  sessions: Session[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onNewChat: () => void;
  onOpenKnowledgeModal: () => void;
  knowledgeStats: KnowledgeStats | null;
  isOpen: boolean;
  onToggle: () => void;
  isLoadingSessions?: boolean;
}

export default function Sidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
  onNewChat,
  onOpenKnowledgeModal,
  knowledgeStats,
  isOpen,
  onToggle,
  isLoadingSessions = false,
}: SidebarProps) {
  return (
    <aside
      className={`fixed md:static inset-y-0 left-0 z-40 w-72 bg-[#090d16]/95 md:bg-transparent backdrop-blur-xl md:backdrop-blur-none border-r border-white/10 flex flex-col transition-transform duration-300 ${
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}
    >
      {/* Top Action Section */}
      <div className="p-3 space-y-2 border-b border-white/5">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-600 hover:opacity-95 text-white font-medium text-sm transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98] cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Conversation</span>
        </button>

        {/* Knowledge Base Manager Button */}
        {/* <button
          onClick={onOpenKnowledgeModal}
          className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-white/10 text-slate-200 text-xs transition-colors group cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500/20">
              <Database className="w-4 h-4" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-slate-200">Knowledge Base</div>
              <div className="text-[11px] text-slate-400">
                {knowledgeStats?.total_documents ?? 0} Docs • {knowledgeStats?.total_chunks ?? 0} Chunks
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-transform group-hover:translate-x-0.5" />
        </button> */}
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        <div className="px-3 py-1.5 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          Recent Conversations
        </div>

        {isLoadingSessions ? (
          <div className="space-y-2 px-1 pt-1">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-900/40 border border-white/[0.04] animate-pulse"
              >
                <div className="w-3.5 h-3.5 rounded bg-slate-800 shrink-0" />
                <div className="flex-1 space-y-1.5 min-w-0">
                  <div
                    className="h-3 bg-slate-800/80 rounded"
                    style={{ width: `${60 + (i % 3) * 15}%` }}
                  />
                  <div className="h-2 bg-slate-800/40 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-slate-500">
            No previous chats. Start a new prompt!
          </div>
        ) : (
          sessions.map((sess) => {
            const isActive = sess.id === activeSessionId;
            return (
              <div
                key={sess.id}
                onClick={() => onSelectSession(sess.id)}
                className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all cursor-pointer ${
                  isActive
                    ? "bg-indigo-600/20 text-indigo-200 border border-indigo-500/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <MessageSquare
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isActive ? "text-indigo-400" : "text-slate-500"
                    }`}
                  />
                  <span className="truncate font-medium">{sess.title}</span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(sess.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                  title="Delete chat session"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Enterprise Architecture Resume Card */}
      <div className="p-3 border-t border-white/5">
        <div className="p-3 rounded-xl bg-slate-900/70 border border-white/10 text-[11px] space-y-2">
          <div className="flex items-center justify-between text-slate-300 font-semibold">
            <span className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-cyan-400" />
              Cloud Architecture
            </span>
            <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-mono">
              Live Cloud
            </span>
          </div>

          <div className="space-y-1 text-slate-400 text-[11px] font-mono leading-tight">
            <div>• LLM: Groq LPU (qwen3.8-27b)</div>
            <div>• Vector DB: Qdrant Cloud</div>
            <div>• Memory: Neon Postgres</div>
            <div>• Agent: LangGraph CRAG</div>
            <div>• Frontend: Next.js 14 App Router</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
