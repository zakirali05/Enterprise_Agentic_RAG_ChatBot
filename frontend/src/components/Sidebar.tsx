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
  X,
  Pin,
  PinOff,
} from "lucide-react";
import { Session, KnowledgeStats } from "@/lib/types";

interface SidebarProps {
  sessions: Session[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onRequestDeleteSession: (session: Session) => void;
  onNewChat: () => void;
  onOpenKnowledgeModal: () => void;
  knowledgeStats: KnowledgeStats | null;
  isOpen: boolean;
  onClose: () => void;
  isPinned?: boolean;
  onTogglePin?: () => void;
  isLoadingSessions?: boolean;
}

export default function Sidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onRequestDeleteSession,
  onNewChat,
  onOpenKnowledgeModal,
  knowledgeStats,
  isOpen,
  onClose,
  isPinned = false,
  onTogglePin,
  isLoadingSessions = false,
}: SidebarProps) {
  const handleSessionClick = (id: string) => {
    onSelectSession(id);
    // If on mobile and NOT pinned, auto-close drawer so user sees chat immediately
    if (!isPinned && window.innerWidth < 768) {
      onClose();
    }
  };

  const handleNewChatClick = () => {
    onNewChat();
    if (!isPinned && window.innerWidth < 768) {
      onClose();
    }
  };

  return (
    <aside
      className={`fixed md:static inset-y-0 left-0 z-40 w-72 sm:w-80 md:w-72 bg-[#090d16] md:bg-transparent backdrop-blur-2xl md:backdrop-blur-none border-r border-white/10 flex flex-col transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none ${
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}
    >
      {/* Mobile Top Bar with Pin & Close Controls */}
      <div className="flex md:hidden items-center justify-between px-3 py-2.5 border-b border-white/10 bg-slate-900/60">
        <span className="text-xs font-semibold text-slate-300">
          Navigation & Chats
        </span>
        <div className="flex items-center gap-1.5">
          {onTogglePin && (
            <button
              onClick={onTogglePin}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer border ${
                isPinned
                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                  : "bg-white/5 text-slate-400 hover:text-slate-200 border-white/5"
              }`}
              title={
                isPinned
                  ? "Sidebar is fixed (won't auto-close on selection)"
                  : "Fix sidebar to keep it open on mobile"
              }
            >
              {isPinned ? (
                <>
                  <Pin className="w-3 h-3 text-cyan-400" />
                  <span>Fixed</span>
                </>
              ) : (
                <>
                  <PinOff className="w-3 h-3" />
                  <span>Fix Sidebar</span>
                </>
              )}
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close sidebar"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Top Action Section */}
      <div className="p-3 space-y-2 border-b border-white/5">
        <button
          onClick={handleNewChatClick}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-600 hover:opacity-95 text-white font-medium text-sm transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98] cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Conversation</span>
        </button>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        <div className="px-3 py-1.5 text-[11px] font-semibold tracking-wider text-slate-400 uppercase flex items-center justify-between">
          <span>Recent Conversations</span>
          <span className="text-[10px] text-slate-400 font-mono">
            {sessions.length}
          </span>
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
                onClick={() => handleSessionClick(sess.id)}
                className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all cursor-pointer ${
                  isActive
                    ? "bg-indigo-600/20 text-indigo-200 border border-indigo-500/30 font-medium"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2 flex-1">
                  <MessageSquare
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isActive ? "text-indigo-400" : "text-slate-500"
                    }`}
                  />
                  <span className="truncate">{sess.title}</span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRequestDeleteSession(sess);
                  }}
                  className="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 hover:!opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all shrink-0 cursor-pointer"
                  title="Delete chat session"
                  aria-label={`Delete conversation ${sess.title}`}
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
            <div>• Storage: Supabase Cloud</div>
            <div>• Memory: Neon Postgres</div>
            <div>• Agent: LangGraph CRAG</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
