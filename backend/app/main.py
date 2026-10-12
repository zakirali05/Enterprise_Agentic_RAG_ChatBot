"""
Enterprise Copilot Backend - Main Application
==============================================
FastAPI Gateway with CORS, lifespan startup hooks, route aggregation,
and automatic enterprise knowledge base initialization (supporting Groq, Qdrant, and Neon).
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.core.llm_client import check_llm_health
from app.core.vector_store import get_vector_manager
from app.services.document_service import get_document_service
from app.api.routes_chat import router as chat_router
from app.api.routes_documents import router as documents_router
from app.api.routes_health import router as health_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan hook:
    Verifies LLM provider (Groq or Ollama) and auto-seeds initial enterprise
    documents into Qdrant Cloud / ChromaDB if empty.
    """
    print(f"\n🚀 Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    
    # 1. LLM Health Check
    llm_health = await check_llm_health()
    if llm_health.get("provider") == "groq":
        if llm_health.get("connected"):
            print(f"⚡ LLM Provider: Groq Cloud LPU connected! Model: {llm_health.get('model')}")
        else:
            print(f"⚠️ Groq connection issue: {llm_health.get('error')}")
    else:
        print(f"📡 Local Ollama connected! Model: {settings.LLM_MODEL}")

    # 2. Check Vector Store and auto-seed sample enterprise docs
    try:
        vm = get_vector_manager()
        stats = vm.get_stats()
        provider_name = stats.get("provider", "Vector Store")
        chunks = stats.get("total_chunks", 0)
        print(f"📚 {provider_name} ready ({chunks} chunks indexed).")

        if chunks == 0:
            print(f"📚 Seeding enterprise policies into {provider_name}...")
            doc_service = get_document_service()
            seeded = doc_service.seed_enterprise_sample_knowledge()
            print(f"✅ Auto-seeded {len(seeded)} documents into {provider_name}!")
    except Exception as e:
        print(f"⚠️ Vector store initialization notice: {e}")

    yield

    print("🛑 Shutting down Enterprise Copilot Backend...")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Full-Stack Enterprise Agentic RAG Copilot powered by LangGraph, Groq LPU, Qdrant Cloud, Neon Postgres, and Next.js.",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(chat_router)
app.include_router(documents_router)
app.include_router(health_router)


@app.get("/", tags=["Root"])
def root_status():
    """Root endpoint verifying gateway health and documentation URL."""
    return {
        "status": "online",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs_url": "/docs",
        "llm_provider": "groq" if settings.GROQ_API_KEY else "ollama",
        "model": settings.GROQ_MODEL if settings.GROQ_API_KEY else settings.LLM_MODEL,
        "vector_db": settings.VECTOR_DB_TYPE,
    }
