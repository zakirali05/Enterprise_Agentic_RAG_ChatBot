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

  // Modals & Drawers
  const [isKnowledgeModalOpen, setIsKnowledgeModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  // Load health and knowledge base stats on mount
  useEffect(() => {
    loadHealthAndStats();
    loadSessions();
  }, []);

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

  const handleDeleteSession = async (sessionId: string) => {
    await deleteSession(sessionId);
    const updated = sessions.filter((s) => s.id !== sessionId);
    setSessions(updated);
    if (activeSessionId === sessionId) {
      if (updated.length > 0) {
        handleSelectSession(updated[0].id);
      } else {
        handleNewChat();
      }
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
                        `\n\n> ⚠️ **Error:** ${errMsg}\n> Please ensure Ollama is running and models are loaded.`,
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
    <div className="flex h-screen w-screen overflow-hidden bg-[#090d16] text-slate-100 font-sans">
      {/* Left Sidebar */}
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onNewChat={handleNewChat}
        onOpenKnowledgeModal={() => setIsKnowledgeModalOpen(true)}
        knowledgeStats={knowledgeStats}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        isLoadingSessions={isLoadingSessions}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <Header onNewChat={handleNewChat} />

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
                  orchestration, ChromaDB vector indexing, and local Ollama inference.
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
    </div>
  );
}
