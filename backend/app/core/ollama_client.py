"""
Ollama Client Integration Module
================================
Provides LangChain integrations for:
- Ollama LLM (qwen3:1.7b) with streaming support
- Ollama Embeddings (nomic-embed-text) for high-precision semantic chunking
- Health checks and connectivity validation with Ollama daemon
"""

import httpx
from typing import Optional, Dict, Any
from langchain_ollama import ChatOllama, OllamaEmbeddings
from app.config import settings


def get_chat_llm(temperature: Optional[float] = None, streaming: bool = False) -> ChatOllama:
    """
    Initializes and returns a LangChain ChatOllama instance.
    
    Args:
        temperature: Sampling temperature (lower = more deterministic/fact-bound).
        streaming: Whether to enable token streaming.
        
    Returns:
        ChatOllama configured for qwen3:1.7b running on local Ollama server.
    """
    temp = temperature if temperature is not None else settings.TEMPERATURE
    return ChatOllama(
        base_url=settings.OLLAMA_BASE_URL,
        model=settings.LLM_MODEL,
        temperature=temp,
        num_predict=settings.MAX_TOKENS,
        streaming=streaming,
    )


def get_embeddings() -> OllamaEmbeddings:
    """
    Initializes and returns the nomic-embed-text embedding model.
    This model produces 768-dimensional embeddings optimized for RAG.
    
    Returns:
        OllamaEmbeddings configured with nomic-embed-text.
    """
    return OllamaEmbeddings(
        base_url=settings.OLLAMA_BASE_URL,
        model=settings.EMBEDDING_MODEL,
    )


async def check_ollama_health() -> Dict[str, Any]:
    """
    Checks if Ollama is running and verifies whether the required
    models (qwen3:1.7b and nomic-embed-text) are available.
    
    Returns:
        Dict containing connection status, latency, and model availability.
    """
    url = f"{settings.OLLAMA_BASE_URL}/api/tags"
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            response = await client.get(url)
            if response.status_code == 200:
                data = response.json()
                models = [m.get("name", "") for m in data.get("models", [])]
                
                has_llm = any(settings.LLM_MODEL in m for m in models)
                has_emb = any(settings.EMBEDDING_MODEL in m for m in models)
                
                return {
                    "connected": True,
                    "endpoint": settings.OLLAMA_BASE_URL,
                    "available_models": models,
                    "llm_ready": has_llm,
                    "embedding_ready": has_emb,
                    "llm_model": settings.LLM_MODEL,
                    "embedding_model": settings.EMBEDDING_MODEL,
                }
            return {
                "connected": False,
                "error": f"Ollama returned HTTP status {response.status_code}",
            }
    except Exception as exc:
        return {
            "connected": False,
            "error": f"Cannot reach Ollama at {settings.OLLAMA_BASE_URL}: {str(exc)}",
        }
