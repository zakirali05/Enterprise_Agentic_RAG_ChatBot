/**
 * API Client & Server-Sent Events (SSE) Streaming Engine
 */

import {
  AgentMode,
  Citation,
  TraceStep,
  Session,
  KnowledgeStats,
  SystemHealth,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function fetchHealth(): Promise<SystemHealth | null> {
  try {
    const res = await fetch(`${API_BASE}/api/health`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error("Health check error:", e);
    return null;
  }
}

export async function fetchSessions(): Promise<Session[]> {
  try {
    const res = await fetch(`${API_BASE}/api/chat/sessions`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return data.sessions || [];
  } catch (e) {
    console.error("Fetch sessions error:", e);
    return [];
  }
}

export async function fetchSessionHistory(sessionId: string) {
  try {
    const res = await fetch(`${API_BASE}/api/chat/sessions/${sessionId}`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error("Fetch session history error:", e);
    return null;
  }
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/chat/sessions/${sessionId}`, {
      method: "DELETE",
    });
    return res.ok;
  } catch (e) {
    console.error("Delete session error:", e);
    return false;
  }
}

export async function fetchKnowledgeStats(): Promise<KnowledgeStats | null> {
  try {
    const res = await fetch(`${API_BASE}/api/documents`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error("Fetch knowledge error:", e);
    return null;
  }
}

export async function uploadDocumentFile(file: File, category = "Enterprise Knowledge") {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("category", category);

  const res = await fetch(`${API_BASE}/api/documents/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Upload failed");
  }
  return await res.json();
}

export async function addDocumentText(title: string, content: string, category = "Corporate Note") {
  const res = await fetch(`${API_BASE}/api/documents/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, content, category }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Note creation failed");
  }
  return await res.json();
}

export async function deleteDocumentFile(filename: string) {
  const res = await fetch(`${API_BASE}/api/documents/${encodeURIComponent(filename)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error("Failed to delete document");
  }
  return await res.json();
}

export async function seedSampleKnowledge() {
  const res = await fetch(`${API_BASE}/api/documents/seed`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error("Failed to seed knowledge");
  }
  return await res.json();
}

export interface StreamCallbacks {
  onTrace?: (trace: TraceStep) => void;
  onCitations?: (citations: Citation[]) => void;
  onToken?: (token: string) => void;
  onDone?: (payload: { generation: string; citations: Citation[]; traces: TraceStep[] }) => void;
  onError?: (error: string) => void;
}

/**
 * Consumes the Server-Sent Events (SSE) stream from FastAPI and fires granular callbacks.
 */
export async function streamChatExecution(
  query: string,
  sessionId: string,
  mode: AgentMode,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
) {
  try {
    const res = await fetch(`${API_BASE}/api/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({ query, session_id: sessionId, mode }),
      signal,
    });

    if (!res.ok) {
      throw new Error(`Server returned error code ${res.status}`);
    }

    if (!res.body) {
      throw new Error("ReadableStream not supported by browser");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const processBlock = (block: string) => {
      const trimmed = block.trim();
      if (!trimmed) return;

      let eventType = "message";
      let dataStr = "";

      const lines = trimmed.split("\n");
      for (const line of lines) {
        const cleanLine = line.trim();
        if (cleanLine.startsWith("event:")) {
          eventType = cleanLine.substring(6).trim();
        } else if (cleanLine.startsWith("data:")) {
          dataStr = cleanLine.substring(5).trim();
        }
      }

      if (!dataStr) return;

      try {
        const parsed = JSON.parse(dataStr);
        if (eventType === "trace") {
          callbacks.onTrace?.(parsed as TraceStep);
        } else if (eventType === "citations") {
          callbacks.onCitations?.(parsed as Citation[]);
        } else if (eventType === "token") {
          callbacks.onToken?.(parsed.text ?? "");
        } else if (eventType === "done") {
          callbacks.onDone?.(parsed);
        } else if (eventType === "error") {
          callbacks.onError?.(parsed.error || "Execution error");
        }
      } catch (jsonErr) {
        console.warn("Failed to parse SSE payload JSON:", jsonErr, dataStr);
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      // Standardize CRLF (\r\n) and CR (\r) into LF (\n) so events split properly
      buffer = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

      const blocks = buffer.split("\n\n");
      // The last element may be incomplete, retain it in the buffer
      buffer = blocks.pop() || "";

      for (const block of blocks) {
        processBlock(block);
      }
    }

    // Process any remaining event in buffer
    if (buffer.trim()) {
      processBlock(buffer);
    }
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.log("Chat stream aborted by user.");
    } else {
      console.error("Stream error:", err);
      callbacks.onError?.(err.message || "Unknown error during streaming");
    }
  }
}
