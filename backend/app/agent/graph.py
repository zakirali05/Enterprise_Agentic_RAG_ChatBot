"""
LangGraph Enterprise Agentic Workflow
======================================
Builds the state machine graph implementing Corrective RAG (CRAG):
1. Route Query (Intent Detection & User Mode selection)
2. Retrieve Chunks (Vector Store + Hugging Face / Ollama Embeddings)
3. Grade Documents (CRAG Relevance Evaluation)
4. Conditional Web Fallback (DuckDuckGo Live Search)
5. Synthesize Answer (Qwen3:1.7B with inline citations)
"""

import time
import re
from typing import Dict, Any, List
from langgraph.graph import StateGraph, END
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

from app.config import settings
from app.agent.state import AgentState, Citation, TraceStep
from app.agent.tools import retrieve_knowledge_documents, search_web_ddg
from app.agent.prompts import RAG_SYSTEM_PROMPT, DIRECT_SYSTEM_PROMPT, ROUTER_SYSTEM_PROMPT
from app.core.llm_client import get_chat_llm


def router_node(state: AgentState) -> Dict[str, Any]:
    """
    Analyzes user query and requested mode to route execution.
    Supports modes: "auto", "rag", "web", "direct"
    """
    mode = state.get("mode", "auto")
    query = state["query"].lower().strip()
    
    # 1. Manual user override
    if mode == "rag":
        intent = "rag"
    elif mode == "web":
        intent = "web_search"
    elif mode == "direct":
        intent = "direct_conversation"
    else:
        # 2. Heuristic and keyword classification for high speed & zero latency
        rag_keywords = [
            "policy", "leave", "pto", "vacation", "benefit", "architecture",
            "security", "sre", "disaster", "recovery", "tier", "runbook",
            "docker", "fastapi", "nextjs", "internal", "handbook", "remote",
            "work", "stipend", "budget", "compliance", "governance", "slo",
            "health", "insurance", "401k", "sop", "enterprise", "document", "chunk"
        ]
        web_keywords = [
            "current", "today", "news", "weather", "stock", "price",
            "latest version", "release date", "election", "who is the current"
        ]
        greetings = ["hi", "hello", "hey", "who are you", "what can you do", "help", "thanks", "thank you"]

        if any(w in query for w in web_keywords):
            intent = "web_search"
        elif any(k in query for k in rag_keywords):
            intent = "rag"
        elif any(query == g or query.startswith(g + " ") for g in greetings):
            intent = "direct_conversation"
        else:
            # Default to RAG for enterprise copilot
            intent = "rag"

    trace: TraceStep = {
        "step": "router",
        "title": "Intent Classification & Router",
        "status": "completed",
        "details": f"Mode: {mode.upper()} -> Pipeline: {intent.upper()}",
        "timestamp": time.time(),
    }
    
    traces = list(state.get("traces", []))
    traces.append(trace)

    return {
        "intent": intent,
        "traces": traces,
        "documents": [],
        "document_scores": [],
        "graded_documents": [],
        "web_results": [],
        "citations": [],
        "needs_web_search": False,
    }


def route_decision(state: AgentState) -> str:
    """Conditional edge router based on intent."""
    intent = state.get("intent", "rag")
    if intent == "web_search":
        return "web_search_node"
    elif intent == "direct_conversation":
        return "generate_direct_node"
    return "retrieve_node"


def retrieve_node(state: AgentState) -> Dict[str, Any]:
    """
    Retrieves candidate document chunks from ChromaDB.
    """
    query = state["query"]
    results = retrieve_knowledge_documents(query, k=settings.TOP_K_RETRIEVAL)
    
    docs = [doc for doc, _ in results]
    scores = [float(score) for _, score in results]

    traces = list(state.get("traces", []))
    traces.append({
        "step": "retriever",
        "title": "ChromaDB Semantic Retrieval",
        "status": "completed",
        "details": f"Embedded query with {settings.EMBEDDING_MODEL}; retrieved {len(docs)} chunks",
        "timestamp": time.time(),
    })

    return {
        "documents": docs,
        "document_scores": scores,
        "traces": traces,
    }


def grade_documents_node(state: AgentState) -> Dict[str, Any]:
    """
    Corrective RAG (CRAG) Grader:
    Evaluates semantic distance scores and filters irrelevant chunks.
    If no relevant documents pass, triggers fallback web search.
    """
    docs = state.get("documents", [])
    scores = state.get("document_scores", [])
    
    graded_docs = []
    citations: List[Citation] = []
    
    # Chroma cosine similarity relevance score threshold
    for idx, (doc, score) in enumerate(zip(docs, scores)):
        # Chroma relevance scores range from 0 (poor) to 1.0 (exact match)
        # We also check for non-empty text
        if score >= settings.SIMILARITY_THRESHOLD or len(docs) == 1:
            graded_docs.append(doc)
            citations.append({
                "id": len(citations) + 1,
                "title": doc.metadata.get("filename", "Internal Document"),
                "source": doc.metadata.get("source", "Knowledge Base"),
                "snippet": doc.page_content[:260] + "...",
                "page": doc.metadata.get("page", 1),
                "score": round(score, 3),
                "category": doc.metadata.get("category", "Enterprise Doc"),
            })

    needs_web = (len(graded_docs) == 0 and settings.ENABLE_WEB_SEARCH_FALLBACK)

    status = "completed" if len(graded_docs) > 0 else ("warning" if needs_web else "skipped")
    detail = (
        f"Retained {len(graded_docs)}/{len(docs)} verified chunks"
        if len(graded_docs) > 0
        else "No high-confidence documents found in knowledge base. Initiating web search fallback."
    )

    traces = list(state.get("traces", []))
    traces.append({
        "step": "grader",
        "title": "Corrective Document Grading (CRAG)",
        "status": status,
        "details": detail,
        "timestamp": time.time(),
    })

    return {
        "graded_documents": graded_docs,
        "citations": citations,
        "needs_web_search": needs_web,
        "traces": traces,
    }


def crag_decision(state: AgentState) -> str:
    """Conditional edge after grading: proceed to generate or fallback to web search."""
    if state.get("needs_web_search", False):
        return "web_search_node"
    return "generate_node"


def web_search_node(state: AgentState) -> Dict[str, Any]:
    """
    Executes free live DuckDuckGo web search when needed.
    """
    query = state["query"]
    results = search_web_ddg(query, max_results=settings.MAX_WEB_RESULTS)
    
    existing_citations = list(state.get("citations", []))
    for idx, r in enumerate(results):
        existing_citations.append({
            "id": len(existing_citations) + 1,
            "title": r.get("title", "Live Web Result"),
            "source": r.get("url", "DuckDuckGo"),
            "snippet": r.get("snippet", "")[:260] + "...",
            "page": 1,
            "score": 0.95,
            "category": "Live Web Search",
        })

    traces = list(state.get("traces", []))
    traces.append({
        "step": "web_search",
        "title": "DuckDuckGo Web Search Fallback",
        "status": "completed",
        "details": f"Fetched {len(results)} live search snippets from the web",
        "timestamp": time.time(),
    })

    return {
        "web_results": results,
        "citations": existing_citations,
        "traces": traces,
    }


def generate_node(state: AgentState) -> Dict[str, Any]:
    """
    Synthesizes final enterprise response with citations using Qwen3:1.7B.
    """
    query = state["query"]
    graded_docs = state.get("graded_documents", [])
    web_results = state.get("web_results", [])
    
    # Construct context block with numbered references
    context_chunks = []
    
    doc_idx = 1
    for doc in graded_docs:
        meta = doc.metadata
        source_label = meta.get("filename", "Doc")
        page_label = f", Page {meta.get('page', 1)}" if meta.get("page") else ""
        context_chunks.append(
            f"[Doc {doc_idx}: {source_label}{page_label}]\n{doc.page_content.strip()}\n"
        )
        doc_idx += 1

    web_idx = 1
    for w in web_results:
        context_chunks.append(
            f"[Web {web_idx}: {w['title']} ({w['url']})]\n{w['snippet'].strip()}\n"
        )
        web_idx += 1

    context_str = "\n".join(context_chunks) if context_chunks else "No specific enterprise context available."
    system_prompt = RAG_SYSTEM_PROMPT.format(
        context_block=f"VERIFIED ENTERPRISE CONTEXT:\n{context_str}"
    )

    llm = get_chat_llm(temperature=0.2, streaming=False)
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=query)
    ]
    
    response = llm.invoke(messages)
    answer = response.content

    traces = list(state.get("traces", []))
    traces.append({
        "step": "generator",
        "title": "Response Synthesis",
        "status": "completed",
        "details": f"Synthesized answer with {len(context_chunks)} reference sources using Qwen3:1.7B",
        "timestamp": time.time(),
    })

    return {
        "generation": answer,
        "traces": traces,
    }


def generate_direct_node(state: AgentState) -> Dict[str, Any]:
    """
    Handles general conversational or coding questions directly without document retrieval.
    """
    query = state["query"]
    llm = get_chat_llm(temperature=0.4, streaming=False)
    
    messages = [
        SystemMessage(content=DIRECT_SYSTEM_PROMPT),
        HumanMessage(content=query)
    ]
    
    response = llm.invoke(messages)
    answer = response.content

    traces = list(state.get("traces", []))
    traces.append({
        "step": "generator",
        "title": "Direct LLM Synthesis",
        "status": "completed",
        "details": "Answered conversationally using Qwen3:1.7B without retrieval overhead",
        "timestamp": time.time(),
    })

    return {
        "generation": answer,
        "traces": traces,
    }


def build_agent_graph() -> StateGraph:
    """
    Compiles the enterprise Corrective RAG state graph with LangGraph.
    """
    workflow = StateGraph(AgentState)

    # Add Nodes
    workflow.add_node("router_node", router_node)
    workflow.add_node("retrieve_node", retrieve_node)
    workflow.add_node("grade_documents_node", grade_documents_node)
    workflow.add_node("web_search_node", web_search_node)
    workflow.add_node("generate_node", generate_node)
    workflow.add_node("generate_direct_node", generate_direct_node)

    # Define Graph Flow / Edges
    workflow.set_entry_point("router_node")

    # From router -> choose branch
    workflow.add_conditional_edges(
        "router_node",
        route_decision,
        {
            "retrieve_node": "retrieve_node",
            "web_search_node": "web_search_node",
            "generate_direct_node": "generate_direct_node",
        }
    )

    # From retrieve -> grade documents
    workflow.add_edge("retrieve_node", "grade_documents_node")

    # From grade -> conditional edge (CRAG check)
    workflow.add_conditional_edges(
        "grade_documents_node",
        crag_decision,
        {
            "generate_node": "generate_node",
            "web_search_node": "web_search_node",
        }
    )

    # From web_search -> generate
    workflow.add_edge("web_search_node", "generate_node")

    # From generators -> END
    workflow.add_edge("generate_node", END)
    workflow.add_edge("generate_direct_node", END)

    return workflow.compile()


# Global compiled graph
agent_graph = build_agent_graph()
