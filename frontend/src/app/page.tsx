"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Shield,
  FileText,
  Cloud,
  Globe,
  Database,
  ArrowRight,
  Menu,
} from "lucide-react";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import MessageItem from "@/components/MessageItem";
import ChatInput from "@/components/ChatInput";
import KnowledgeBaseModal from "@/components/KnowledgeBaseModal";
import CitationsDrawer from "@/components/CitationsDrawer";
import ChatSkeleton from "@/components/ChatSkeleton";
import ConfirmModal from "@/components/ConfirmModal";
import ToastContainer, { ToastItem, ToastType } from "@/components/Toast";
import {
  Message,
  Session,
  AgentMode,
  SystemHealth,
  KnowledgeStats,
  Citation,
  TraceStep,
} from "@/lib/types";
import {
  fetchHealth,
  fetchSessions,
  fetchSessionHistory,
  deleteSession,
  fetchKnowledgeStats,
  streamChatExecution,
} from "@/lib/api";

export default function Home() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [mode, setMode] = useState<AgentMode>("auto");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // System & Knowledge State
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [knowledgeStats, setKnowledgeStats] = useState<KnowledgeStats | null>(null);

  // Modals, Drawers & Mobile Sidebar State
  const [isKnowledgeModalOpen, setIsKnowledgeModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [isDeletingSession, setIsDeletingSession] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [citationsDrawer, setCitationsDrawer] = useState<{
    isOpen: boolean;
    citations: Citation[];
    selectedId?: number | null;
  }>({
    isOpen: false,
    citations: [],
    selectedId: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Toast helper
  const showToast = (
    message: string,
    type: ToastType = "info",
    title?: string
  ) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    setToasts((prev) => [...prev, { id, message, type, title }]);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Load health, knowledge base stats, and sidebar pinned preference on mount
  useEffect(() => {
    loadHealthAndStats();
    loadSessions();

    if (typeof window !== "undefined") {
      const savedPinned = localStorage.getItem("copilot_sidebar_pinned") === "true";
      setIsSidebarPinned(savedPinned);
      if (savedPinned) {
        setSidebarOpen(true);
      }
    }
  }, []);

  const toggleSidebarPin = () => {
    setIsSidebarPinned((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("copilot_sidebar_pinned", String(next));
      }
      if (next) {
        setSidebarOpen(true);
        showToast("Sidebar fixed on mobile screen", "info", "Sidebar Fixed");
      } else {
        showToast("Sidebar switched to overlay drawer mode", "info", "Drawer Mode");
      }
      return next;
    });
  };

  const loadHealthAndStats = async () => {
    const h = await fetchHealth();
    setHealth(h);
    const k = await fetchKnowledgeStats();
    setKnowledgeStats(k);
  };

  const loadSessions = async () => {
    setIsLoadingSessions(true);
    const sList = await fetchSessions();
    setSessions(sList);
    setIsLoadingSessions(false);

    // Retrieve last active session from localStorage if present
    const savedActiveId =
      typeof window !== "undefined"
        ? localStorage.getItem("copilot_active_session_id")
        : null;

    const targetSessionId =
      savedActiveId && sList.some((s) => s.id === savedActiveId)
        ? savedActiveId
        : sList.length > 0
        ? sList[0].id
        : null;

    if (targetSessionId) {
      handleSelectSession(targetSessionId);
    } else {
      handleNewChat();
    }
  };

  const handleSelectSession = async (sessionId: string) => {
    setActiveSessionId(sessionId);
    if (typeof window !== "undefined") {
      localStorage.setItem("copilot_active_session_id", sessionId);
    }
    setIsLoadingHistory(true);
    const history = await fetchSessionHistory(sessionId);
    setIsLoadingHistory(false);
    if (history && history.messages) {
      setMessages(history.messages);
    } else {
      setMessages([]);
    }
  };

  const handleNewChat = () => {
    const newId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    setActiveSessionId(newId);
    if (typeof window !== "undefined") {
      localStorage.setItem("copilot_active_session_id", newId);
    }
    setMessages([]);
  };

  const handleRequestDeleteSession = (session: Session) => {
    setSessionToDelete(session);
  };

  const handleConfirmDeleteSession = async () => {
    if (!sessionToDelete) return;
    setIsDeletingSession(true);
    try {
      const ok = await deleteSession(sessionToDelete.id);
      if (ok) {
        const updated = sessions.filter((s) => s.id !== sessionToDelete.id);
        setSessions(updated);
        showToast(
          `Conversation "${sessionToDelete.title}" deleted successfully`,
          "success",
          "Conversation Deleted"
        );
        if (activeSessionId === sessionToDelete.id) {
          if (updated.length > 0) {
            handleSelectSession(updated[0].id);
          } else {
            handleNewChat();
          }
        }
      } else {
        showToast("Could not delete conversation from server", "error", "Delete Failed");
      }
    } catch (err: any) {
      showToast(`Error deleting conversation: ${err.message}`, "error", "Delete Failed");
    } finally {
      setIsDeletingSession(false);
      setSessionToDelete(null);
    }
  };

  const handleOpenCitation = (citationId?: number) => {
    // Collect all citations from the latest assistant message or specific message
    const allCitations: Citation[] = [];
    messages.forEach((m) => {
      if (m.citations) {
        allCitations.push(...m.citations);
      }
    });

    setCitationsDrawer({
      isOpen: true,
      citations: allCitations,
      selectedId: citationId ?? null,
    });
  };

  const handleSendMessage = async (queryText: string) => {
    if (!queryText.trim() || isLoading) return;

    const currentSession = activeSessionId || `session-${Date.now()}`;
    if (!activeSessionId) {
      setActiveSessionId(currentSession);
    }
    if (typeof window !== "undefined") {
      localStorage.setItem("copilot_active_session_id", currentSession);
    }

    // Optimistically insert session into sidebar immediately so it is visible
    const promptTitle =
      queryText.trim().slice(0, 32) + (queryText.trim().length > 32 ? "..." : "");
    setSessions((prev) => {
      const exists = prev.some((s) => s.id === currentSession);
      if (!exists) {
        return [
          {
            id: currentSession,
            title: promptTitle,
            created_at: "Just now",
            updated_at: "Just now",
            message_count: 1,
          },
          ...prev,
        ];
      }
      return prev;
    });

    // 1. Add User Message
    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      role: "user",
      content: queryText,
      timestamp: Date.now(),
    };

    // 2. Add Placeholder Assistant Message with streaming state
    const assistantMsgId = `asst-${Date.now()}`;
    const initialAssistantMsg: Message = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      traces: [],
      citations: [],
      mode,
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, initialAssistantMsg]);
    setIsLoading(true);

    abortControllerRef.current = new AbortController();

    try {
      await streamChatExecution(
        queryText,
        currentSession,
        mode,
        {
          onTrace: (trace: TraceStep) => {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantMsgId) return m;
                const existing = m.traces || [];
                // Check if step exists to update or append
                const foundIndex = existing.findIndex((t) => t.step === trace.step);
                let updatedTraces = [...existing];
                if (foundIndex >= 0) {
                  updatedTraces[foundIndex] = trace;
                } else {
                  updatedTraces.push(trace);
                }
                return { ...m, traces: updatedTraces };
              })
            );
          },
          onCitations: (newCitations: Citation[]) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId ? { ...m, citations: newCitations } : m
              )
            );
          },
          onToken: (token: string) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, content: m.content + token }
                  : m
              )
            );
          },
          onDone: (payload) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? {
                      ...m,
                      content: payload.generation || m.content,
                      citations: payload.citations || m.citations,
                      traces: payload.traces || m.traces,
                      isStreaming: false,
                    }
                  : m
              )
            );
            setIsLoading(false);
            // Refresh sessions list to update title
            fetchSessions().then(setSessions);
          },
          onError: (errMsg: string) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? {
                      ...m,
                      content:
                        m.content +
                        `\n\n> ⚠️ **Error:** ${errMsg}\n> Please ensure backend server is running and API credentials (GROQ_API_KEY, HUGGINGFACE_API_KEY) are configured.`,
                      isStreaming: false,
                    }
                  : m
              )
            );
            setIsLoading(false);
          },
        },
        abortControllerRef.current.signal
      );
    } catch (e: any) {
      console.error("Execution error:", e);
    } finally {
      setIsLoading(false);
      setMessages((prev) =>
        prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m))
      );
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsLoading(false);
    setMessages((prev) =>
      prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m))
    );
  };

  // Sample prompt cards
  const starterPrompts = [
    {
      title: "Remote Work & Stipend",
      query: "What is our company's remote work policy and annual home office stipend?",
      icon: <FileText className="w-4 h-4 text-cyan-400" />,
      category: "HR Policy",
    },
    {
      title: "AI Security & Governance",
      query: "Explain our Tier 2 data classification and acceptable AI use policy.",
      icon: <Shield className="w-4 h-4 text-purple-400" />,
      category: "Security",
    },
    {
      title: "SRE Disaster Recovery",
      query: "What are our SRE Disaster Recovery SLOs and container failover protocols?",
      icon: <Cloud className="w-4 h-4 text-blue-400" />,
      category: "DevOps",
    },
    {
      title: "Enterprise Agentic AI",
      query: "Search web for latest enterprise agentic AI architectures in 2026.",
      icon: <Globe className="w-4 h-4 text-emerald-400" />,
      category: "Web Intelligence",
    },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#090d16] text-slate-100 font-sans relative">
      {/* Mobile Backdrop for Drawer Mode */}
      {sidebarOpen && !isSidebarPinned && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden animate-fade-in cursor-pointer"
          aria-hidden="true"
        />
      )}

      {/* Left Sidebar */}
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onRequestDeleteSession={handleRequestDeleteSession}
        onNewChat={handleNewChat}
        onOpenKnowledgeModal={() => setIsKnowledgeModalOpen(true)}
        knowledgeStats={knowledgeStats}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isPinned={isSidebarPinned}
        onTogglePin={toggleSidebarPin}
        isLoadingSessions={isLoadingSessions}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Header */}
        <Header
          onNewChat={handleNewChat}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          isSidebarOpen={sidebarOpen}
          isSidebarPinned={isSidebarPinned}
        />

        {/* Chat Feed */}
        <div className="flex-1 overflow-y-auto">
          {isLoadingHistory ? (
            <ChatSkeleton />
          ) : messages.length === 0 ? (
            /* Empty State / Welcome Hero */
            <div className="max-w-3xl mx-auto px-4 py-12 md:py-16 text-center space-y-8 animate-fade-in">
              <div className="space-y-3">
                <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-cyan-500/20 border border-white/10 shadow-xl shadow-indigo-500/10">
                  <Sparkles className="w-8 h-8 text-cyan-400 animate-pulse" />
                </div>
                <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  Enterprise Agentic RAG Copilot
                </h2>
                <p className="text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
                  Autonomous enterprise intelligence platform combining LangGraph state
                  orchestration, Qdrant Cloud vector indexing, and Groq / Hugging Face inference.
                  Ask questions across corporate documents or search the live web.
                </p>
              </div>

              {/* Starter Question Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                {starterPrompts.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(p.query)}
                    className="p-4 rounded-xl glass-panel hover:bg-slate-900/80 border border-white/10 hover:border-indigo-500/50 transition-all group flex flex-col justify-between cursor-pointer text-left"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-indigo-500/20 transition-colors">
                          {p.icon}
                        </div>
                        <span className="text-xs font-semibold text-slate-200">
                          {p.title}
                        </span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-slate-400 font-mono">
                        {p.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2 mb-2 group-hover:text-slate-300 transition-colors">
                      "{p.query}"
                    </p>
                    <div className="flex items-center gap-1 text-[11px] text-indigo-400 group-hover:text-cyan-300 font-medium">
                      <span>Execute prompt</span>
                      <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Message List */
            <div className="max-w-4xl mx-auto divide-y divide-white/[0.04]">
              {messages.map((msg) => (
                <MessageItem
                  key={msg.id}
                  message={msg}
                  onOpenCitation={handleOpenCitation}
                />
              ))}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          )}
        </div>

        {/* Input Bar with Mode Selectors (CRAG, Docs Only, Web) */}
        <ChatInput
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          onStop={handleStop}
          mode={mode}
          onModeChange={setMode}
          onOpenKnowledgeModal={() => setIsKnowledgeModalOpen(true)}
        />
      </div>

      {/* Knowledge Base Modal */}
      <KnowledgeBaseModal
        isOpen={isKnowledgeModalOpen}
        onClose={() => setIsKnowledgeModalOpen(false)}
        knowledgeStats={knowledgeStats}
        onRefresh={loadHealthAndStats}
        onToast={showToast}
      />

      {/* Citations Inspector Drawer */}
      <CitationsDrawer
        citations={citationsDrawer.citations}
        isOpen={citationsDrawer.isOpen}
        onClose={() =>
          setCitationsDrawer((prev) => ({ ...prev, isOpen: false }))
        }
        selectedCitationId={citationsDrawer.selectedId}
      />

      {/* Confirmation Modal for Session Deletion */}
      <ConfirmModal
        isOpen={!!sessionToDelete}
        title="Delete Conversation"
        message={
          <div>
            <p>
              Are you sure you want to delete{" "}
              <span className="font-semibold text-slate-100">
                "{sessionToDelete?.title}"
              </span>
              ?
            </p>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              This will permanently delete this conversation and all associated messages. This action cannot be undone.
            </p>
          </div>
        }
        confirmText="Delete Conversation"
        confirmVariant="danger"
        isLoading={isDeletingSession}
        onConfirm={handleConfirmDeleteSession}
        onCancel={() => {
          if (!isDeletingSession) setSessionToDelete(null);
        }}
      />

      {/* Global Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
