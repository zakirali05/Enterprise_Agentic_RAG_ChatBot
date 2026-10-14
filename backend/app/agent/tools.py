"""
Agent Tools Module
==================
Integrates tools available to the LangGraph copilot:
1. Enterprise Knowledge Retrieval (Qdrant / ChromaDB + Embeddings)
2. Free DuckDuckGo Web Search (Real-time live fallback with no API keys)
"""

import time
from typing import List, Dict, Any, Tuple
from duckduckgo_search import DDGS
from langchain_core.documents import Document
from app.config import settings
from app.core.vector_store import get_vector_manager


def retrieve_knowledge_documents(query: str, k: int = 4) -> List[Tuple[Document, float]]:
    """
    Searches the persistent vector store using semantic embeddings (Hugging Face / Ollama).
    
    Args:
        query: User's search query.
        k: Top-K document chunks to retrieve.
        
    Returns:
        List of (Document, score) tuples.
    """
    manager = get_vector_manager()
    try:
        results = manager.similarity_search_with_score(query, k=k)
        return results
    except Exception as e:
        print(f"[Tools] Error querying vector store: {e}")
        return []


def search_web_ddg(query: str, max_results: int = 4) -> List[Dict[str, str]]:
    """
    Executes free, real-time web search via DuckDuckGo without requiring API keys.
    Used for general queries, real-time facts, and CRAG fallback.
    
    Args:
        query: Search query string.
        max_results: Number of results to return.
        
    Returns:
        List of dicts containing 'title', 'href', 'body'.
    """
    try:
        ddgs = DDGS()
        results = list(ddgs.text(query, max_results=max_results))
        clean_results = []
        for r in results:
            clean_results.append({
                "title": r.get("title", "Web Source"),
                "url": r.get("href", ""),
                "snippet": r.get("body", ""),
            })
        return clean_results
    except Exception as e:
        print(f"[Tools] DuckDuckGo search error: {e}")
        return []
