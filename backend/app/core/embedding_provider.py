"""
Unified Embedding Provider Module
=================================
Provides enterprise-grade, low-latency semantic embeddings for Agentic RAG:
1. Hugging Face Embeddings via FastEmbed (BAAI/bge-small-en-v1.5, 384d):
   - Authenticated with HUGGINGFACE_API_KEY
   - Zero-cloud cost, high-throughput ONNX runtime
   - Eliminates PyTorch heavy footprint for free-tier cloud deployment (Render/Railway/Vercel)
2. Ollama Embeddings (nomic-embed-text, 768d) for local air-gapped environments.
"""

import os
from typing import List, Optional
from langchain_core.embeddings import Embeddings
from app.config import settings


class HuggingFaceFastEmbeddings(Embeddings):
    """
    LangChain Embeddings implementation utilizing the FastEmbed ONNX runtime
    connected to Hugging Face models with optional API authentication.
    """

    def __init__(self, model_name: str = "BAAI/bge-small-en-v1.5", hf_token: Optional[str] = None):
        if hf_token:
            os.environ["HF_TOKEN"] = hf_token
            os.environ["HUGGINGFACE_API_KEY"] = hf_token

        from fastembed import TextEmbedding
        self.model_name = model_name
        self._model = TextEmbedding(model_name=model_name)

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Generates embeddings for a batch of document chunks."""
        if not texts:
            return []
        embeddings = self._model.embed(texts)
        return [vec.tolist() for vec in embeddings]

    def embed_query(self, text: str) -> List[float]:
        """Generates embedding for a single search or agent query."""
        embedding = next(iter(self._model.embed([text])))
        return embedding.tolist()


_embeddings_instance: Optional[Embeddings] = None


def get_embeddings() -> Embeddings:
    """
    Returns an initialized LangChain Embeddings instance.
    Prioritizes Hugging Face (BAAI/bge-small-en-v1.5) when HUGGINGFACE_API_KEY
    is present or when EMBEDDING_PROVIDER is 'huggingface'.
    """
    global _embeddings_instance
    if _embeddings_instance is not None:
        return _embeddings_instance

    provider = (getattr(settings, "EMBEDDING_PROVIDER", "huggingface") or "huggingface").lower()
    hf_key = getattr(settings, "HUGGINGFACE_API_KEY", None)

    # Use Hugging Face if key is provided or provider is huggingface
    if hf_key or provider == "huggingface":
        model_name = getattr(settings, "EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5")
        # Guard against legacy nomic-embed-text string in .env
        if "nomic" in model_name.lower():
            model_name = "BAAI/bge-small-en-v1.5"
        
        _embeddings_instance = HuggingFaceFastEmbeddings(
            model_name=model_name,
            hf_token=hf_key,
        )
        return _embeddings_instance

    # Fallback: Local Ollama
    try:
        from langchain_ollama import OllamaEmbeddings
        _embeddings_instance = OllamaEmbeddings(
            base_url=settings.OLLAMA_BASE_URL,
            model=settings.EMBEDDING_MODEL,
        )
        return _embeddings_instance
    except Exception as e:
        print(f"Warning: Could not initialize Ollama embeddings ({e}). Falling back to Hugging Face.")
        _embeddings_instance = HuggingFaceFastEmbeddings(
            model_name="BAAI/bge-small-en-v1.5",
            hf_token=hf_key,
        )
        return _embeddings_instance
