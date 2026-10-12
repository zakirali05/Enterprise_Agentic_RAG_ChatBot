"""
Health & System Status API Routes
=================================
Provides real-time health diagnostics for the FastAPI service,
LLM provider (Groq LPU or Ollama), embedding models, and Vector DB (Qdrant or Chroma).
"""

from fastapi import APIRouter
from app.config import settings
from app.core.llm_client import check_llm_health
from app.core.vector_store import get_vector_manager

router = APIRouter(prefix="/api/health", tags=["System Health & Diagnostics"])


@router.get("")
async def system_health():
    """
    Performs full health verification across all enterprise copilot components:
    - FastAPI Gateway
    - LLM Engine (Groq LPU or Ollama)
    - Vector Store (Qdrant Cloud or ChromaDB)
    """
    llm_status = await check_llm_health()
    vm = get_vector_manager()
    db_stats = vm.get_stats()

    is_healthy = llm_status.get("connected", False)

    return {
        "status": "healthy" if is_healthy else "degraded",
        "app": {
            "name": settings.APP_NAME,
            "version": settings.APP_VERSION,
        },
        "llm": llm_status,
        "vector_store": {
            "provider": db_stats.get("provider", "Qdrant Cloud" if settings.VECTOR_DB_TYPE == "qdrant" else "ChromaDB"),
            "total_chunks": db_stats.get("total_chunks", 0),
            "total_documents": db_stats.get("total_documents", 0),
            "collection_name": db_stats.get("collection_name", ""),
        },
        "database": {
            "postgres": bool(settings.DATABASE_URL),
            "redis": bool(settings.UPSTASH_REDIS_REST_URL),
        },
        "rag_config": {
            "chunk_size": settings.CHUNK_SIZE,
            "chunk_overlap": settings.CHUNK_OVERLAP,
            "top_k": settings.TOP_K_RETRIEVAL,
            "similarity_threshold": settings.SIMILARITY_THRESHOLD,
            "web_search_enabled": settings.ENABLE_WEB_SEARCH_FALLBACK,
        }
    }
