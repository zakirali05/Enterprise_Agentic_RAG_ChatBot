/**
 * Enterprise Copilot Frontend - TypeScript Definitions
 */

export type AgentMode = "auto" | "rag" | "web" | "direct";

export interface Citation {
  id: number;
  title: string;
  source: string;
  snippet: string;
  page: number;
  score: number;
  category: string;
}

export interface TraceStep {
  step: string;
  title: string;
  status: "running" | "completed" | "warning" | "skipped";
  details: string;
  timestamp: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  citations?: Citation[];
  traces?: TraceStep[];
  mode?: AgentMode;
  isStreaming?: boolean;
}

export interface Session {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface DocumentInfo {
  filename: string;
  chunk_count: number;
  category: string;
  uploaded_at: string;
  file_size: number;
}

export interface KnowledgeStats {
  total_chunks: number;
  total_documents: number;
  documents: DocumentInfo[];
  collection_name: string;
  embedding_model: string;
  provider?: string;
}

export interface SystemHealth {
  status: "healthy" | "degraded" | "offline";
  app: {
    name: string;
    version: string;
  };
  ollama: {
    connected: boolean;
    endpoint: string;
    available_models: string[];
    llm_ready: boolean;
    embedding_ready: boolean;
    llm_model: string;
    embedding_model: string;
  };
  vector_store: {
    total_chunks: number;
    total_documents: number;
    collection_name: string;
  };
  rag_config: {
    chunk_size: number;
    chunk_overlap: number;
    top_k: number;
    similarity_threshold: number;
    web_search_enabled: boolean;
  };
}
