"""
Enterprise Copilot Backend - Configuration Module
=================================================
Manages all environment configurations, model selections, Ollama endpoints,
vector database persistence, and RAG retrieval parameters using Pydantic Settings.
"""

import os
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables or sensible enterprise defaults.
    """
    # Application Info
    APP_NAME: str = "Enterprise Agentic RAG Copilot"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    # LLM Provider Configuration ("groq" or "ollama")
    LLM_PROVIDER: str = "groq"
    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: str = "qwen/qwen3.8-27b"

    # Ollama Local LLM & Embedding Settings (100% Free & Local)
    # Default host points to localhost; in Docker this can be overridden via OLLAMA_BASE_URL
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "qwen3:1.7b")
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "nomic-embed-text")
    
    # Model Generation Parameters
    TEMPERATURE: float = 0.2
    MAX_TOKENS: int = 2048
    
    # Paths & Storage
    BASE_DIR: Path = Path(__file__).resolve().parent.parent
    DATA_DIR: Path = BASE_DIR / "data"
    CHROMA_PERSIST_DIR: str = str(DATA_DIR / "chroma_db")
    UPLOAD_DIR: str = str(DATA_DIR / "uploads")
    SESSIONS_DIR: str = str(DATA_DIR / "sessions")
    
    # RAG & Chunking Parameters
    # nomic-embed-text supports up to 2048 tokens; 700 chars (~150-200 tokens) provides high semantic granularity
    CHUNK_SIZE: int = 700
    CHUNK_OVERLAP: int = 120
    TOP_K_RETRIEVAL: int = 4
    SIMILARITY_THRESHOLD: float = 0.35  # Relevance threshold for CRAG grading
    
    # Web Search Settings
    ENABLE_WEB_SEARCH_FALLBACK: bool = True
    MAX_WEB_RESULTS: int = 4

    # Optional Production Cloud Database URIs (Free Tiers Supported)
    # 1. Relational Database (Conversations & Sessions: Neon Postgres or Supabase)
    DATABASE_URL: Optional[str] = None  # e.g. postgresql://user:pass@ep-cool.us-east-1.aws.neon.tech/neondb?sslmode=require
    
    # 2. NoSQL Database Alternative (MongoDB Atlas Free M0)
    MONGODB_URI: Optional[str] = None   # e.g. mongodb+srv://user:pass@cluster0.mongodb.net/copilot?retryWrites=true&w=majority

    # 3. Cloud Vector Databases (Qdrant Cloud Free 1GB or Pinecone Starter)
    VECTOR_DB_TYPE: str = "chroma"      # "chroma" (local free), "qdrant" (cloud free), or "pinecone"
    QDRANT_URL: Optional[str] = None    # e.g. https://xyz-cluster.qdrant.io:6333
    QDRANT_API_KEY: Optional[str] = None
    PINECONE_API_KEY: Optional[str] = None
    PINECONE_INDEX: Optional[str] = "enterprise-copilot"

    # 4. In-Memory Session Cache (Upstash Redis Free Tier)
    UPSTASH_REDIS_REST_URL: Optional[str] = None
    UPSTASH_REDIS_REST_TOKEN: Optional[str] = None

    # 5. Cloud Object Storage for Document Files (Cloudflare R2 Free 10GB)
    R2_ACCOUNT_ID: Optional[str] = None
    R2_ACCESS_KEY_ID: Optional[str] = None
    R2_SECRET_ACCESS_KEY: Optional[str] = None
    R2_BUCKET_NAME: Optional[str] = "copilot-documents"

    class Config:
        # Automatically detects .env in both backend/ and project root
        env_file = (
            str(Path(__file__).resolve().parent.parent / ".env"),
            str(Path(__file__).resolve().parent.parent.parent / ".env"),
        )
        extra = "allow"


# Global singleton instance of Settings
settings = Settings()

# Ensure required data directories exist
os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.SESSIONS_DIR, exist_ok=True)
