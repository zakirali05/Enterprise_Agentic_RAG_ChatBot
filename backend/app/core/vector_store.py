"""
Vector Store Management Module
==============================
Supports both:
1. Qdrant Cloud (Production Free 1GB Cluster)
2. ChromaDB (Local Embedded Persistence)
Using semantic embeddings (Hugging Face / Ollama).
"""

import os
from typing import List, Tuple, Dict, Any, Optional
from langchain_core.documents import Document
from app.config import settings
from app.core.embedding_provider import get_embeddings


class VectorStoreManager:
    """
    Manages vector indexing and retrieval across Qdrant Cloud or local ChromaDB.
    """
    _instance: Optional["VectorStoreManager"] = None

    def __init__(self):
        self.provider = getattr(settings, "VECTOR_DB_TYPE", "chroma").lower()
        self.embeddings = get_embeddings()
        try:
            probe = self.embeddings.embed_query("dimension probe")
            self.embedding_dim = len(probe)
        except Exception as e:
            print(f"Warning detecting embedding dimension: {e}")
            self.embedding_dim = 384
        self.collection_name = "enterprise_knowledge"
        self._qdrant_client = None
        self._qdrant_store = None
        self._chroma_store = None
        self._init_store()

    def _init_store(self):
        """Initializes either Qdrant Cloud or ChromaDB based on settings."""
        if self.provider == "qdrant" and settings.QDRANT_URL and settings.QDRANT_API_KEY:
            try:
                from qdrant_client import QdrantClient
                from qdrant_client.http.models import Distance, VectorParams
                from langchain_qdrant import QdrantVectorStore

                self._qdrant_client = QdrantClient(
                    url=settings.QDRANT_URL,
                    api_key=settings.QDRANT_API_KEY,
                )

                # Ensure collection exists and matches the embedding dimension
                if not self._qdrant_client.collection_exists(self.collection_name):
                    self._qdrant_client.create_collection(
                        collection_name=self.collection_name,
                        vectors_config=VectorParams(size=self.embedding_dim, distance=Distance.COSINE),
                    )
                else:
                    col_info = self._qdrant_client.get_collection(self.collection_name)
                    existing_dim = col_info.config.params.vectors.size
                    if existing_dim != self.embedding_dim:
                        emb_name = getattr(self.embeddings, 'model_name', settings.EMBEDDING_MODEL)
                        print(f"🔄 Recreating Qdrant collection: dimension changed from {existing_dim} to {self.embedding_dim} ({emb_name})")
                        self._qdrant_client.delete_collection(self.collection_name)
                        self._qdrant_client.create_collection(
                            collection_name=self.collection_name,
                            vectors_config=VectorParams(size=self.embedding_dim, distance=Distance.COSINE),
                        )

                # Ensure payload index on metadata.filename for filtering and deletion
                try:
                    from qdrant_client.http.models import PayloadSchemaType
                    self._qdrant_client.create_payload_index(
                        collection_name=self.collection_name,
                        field_name="metadata.filename",
                        field_schema=PayloadSchemaType.KEYWORD,
                    )
                except Exception:
                    pass

                self._qdrant_store = QdrantVectorStore(
                    client=self._qdrant_client,
                    collection_name=self.collection_name,
                    embedding=self.embeddings,
                )
                print(f"✅ Connected to Qdrant Cloud Cluster: {self.collection_name}")
                return
            except Exception as e:
                print(f"⚠️ Failed to connect to Qdrant Cloud ({e}). Falling back to local ChromaDB.")
                self.provider = "chroma"

        # Fallback to local ChromaDB
        from langchain_chroma import Chroma
        self._chroma_store = Chroma(
            collection_name="enterprise_knowledge_base",
            embedding_function=self.embeddings,
            persist_directory=settings.CHROMA_PERSIST_DIR,
        )

    @classmethod
    def get_instance(cls) -> "VectorStoreManager":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def add_documents(self, documents: List[Document]) -> List[str]:
        """Embeds and indexes document chunks."""
        if not documents:
            return []

        if self.provider == "qdrant" and self._qdrant_store:
            return self._qdrant_store.add_documents(documents)
        elif self._chroma_store:
            return self._chroma_store.add_documents(documents)
        return []

    def similarity_search_with_score(
        self, query: str, k: int = 4
    ) -> List[Tuple[Document, float]]:
        """Performs semantic similarity search."""
        if self.provider == "qdrant" and self._qdrant_store:
            return self._qdrant_store.similarity_search_with_score(query, k=k)
        elif self._chroma_store:
            return self._chroma_store.similarity_search_with_relevance_scores(query, k=k)
        return []

    def delete_by_filename(self, filename: str) -> int:
        """Deletes chunks belonging to a document from Qdrant or ChromaDB."""
        try:
            if self.provider == "qdrant" and self._qdrant_client:
                from qdrant_client.http.models import Filter, FieldCondition, MatchValue
                # 1. Attempt filter deletion
                try:
                    del_filter = Filter(
                        must=[
                            FieldCondition(
                                key="metadata.filename",
                                match=MatchValue(value=filename)
                            )
                        ]
                    )
                    self._qdrant_client.delete(
                        collection_name=self.collection_name,
                        points_selector=del_filter,
                    )
                except Exception as filter_err:
                    print(f"Filter delete warning: {filter_err}")

                # 2. Scroll and delete points by IDs matching filename or source to guarantee full cleanup
                matching_ids = []
                offset = None
                while True:
                    records, offset = self._qdrant_client.scroll(
                        collection_name=self.collection_name,
                        limit=250,
                        offset=offset,
                        with_payload=True,
                        with_vectors=False,
                    )
                    for r in records:
                        meta = (r.payload or {}).get("metadata", {})
                        fname = meta.get("filename") or (r.payload or {}).get("source") or ""
                        if fname == filename:
                            matching_ids.append(r.id)
                    if offset is None:
                        break

                if matching_ids:
                    self._qdrant_client.delete(
                        collection_name=self.collection_name,
                        points_selector=matching_ids,
                    )
                    return len(matching_ids)
                return 1
            elif self._chroma_store:
                collection = self._chroma_store._collection
                results = collection.get(where={"filename": filename})
                ids = results.get("ids", []) or []
                if not ids:
                    results = collection.get(where={"source": filename})
                    ids = results.get("ids", []) or []
                if ids:
                    collection.delete(ids=ids)
                    return len(ids)
            return 0
        except Exception as e:
            print(f"Error deleting file {filename}: {e}")
            return 0

    def get_stats(self) -> Dict[str, Any]:
        """Returns dynamic statistics and document catalog for vector store."""
        try:
            if self.provider == "qdrant" and self._qdrant_client:
                col_info = self._qdrant_client.get_collection(self.collection_name)
                total_points = col_info.points_count or 0

                # Dynamically aggregate unique documents from Qdrant payloads
                unique_files = {}
                offset = None
                while True:
                    records, offset = self._qdrant_client.scroll(
                        collection_name=self.collection_name,
                        limit=100,
                        offset=offset,
                        with_payload=True,
                        with_vectors=False,
                    )
                    for r in records:
                        meta = (r.payload or {}).get("metadata", {})
                        fname = meta.get("filename") or (r.payload or {}).get("source") or "unknown_document"
                        storage_url = meta.get("storage_url")
                        if fname not in unique_files:
                            unique_files[fname] = {
                                "filename": fname,
                                "chunk_count": 0,
                                "category": meta.get("category", "Enterprise Knowledge"),
                                "uploaded_at": meta.get("uploaded_at", "Synced"),
                                "file_size": meta.get("file_size", 0),
                                "storage_url": storage_url or "",
                            }
                        unique_files[fname]["chunk_count"] += 1
                    if offset is None:
                        break

                return {
                    "total_chunks": total_points,
                    "total_documents": len(unique_files),
                    "documents": list(unique_files.values()),
                    "collection_name": self.collection_name,
                    "provider": "Qdrant Cloud (AWS)",
                    "embedding_model": getattr(self.embeddings, "model_name", settings.EMBEDDING_MODEL),
                    "embedding_dim": self.embedding_dim,
                }
            elif self._chroma_store:
                count = self._chroma_store._collection.count()
                metadata_results = self._chroma_store._collection.get(include=["metadatas"])
                metadatas = metadata_results.get("metadatas", [])
                unique_files = {}
                for m in metadatas:
                    if m:
                        fname = m.get("filename") or m.get("source")
                        if fname:
                            storage_url = m.get("storage_url")
                            if fname not in unique_files:
                                unique_files[fname] = {
                                    "filename": fname,
                                    "chunk_count": 0,
                                    "category": m.get("category", "General"),
                                    "uploaded_at": m.get("uploaded_at", "Unknown"),
                                    "file_size": m.get("file_size", 0),
                                    "storage_url": storage_url or "",
                                }
                            unique_files[fname]["chunk_count"] += 1

                return {
                    "total_chunks": count,
                    "total_documents": len(unique_files),
                    "documents": list(unique_files.values()),
                    "collection_name": "enterprise_knowledge_base",
                    "provider": "Local ChromaDB",
                    "embedding_model": getattr(self.embeddings, "model_name", settings.EMBEDDING_MODEL),
                    "embedding_dim": self.embedding_dim,
                }
        except Exception as e:
            return {
                "total_chunks": 0,
                "total_documents": 0,
                "documents": [],
                "error": str(e),
                "provider": self.provider,
            }

    def reset(self):
        """Resets the vector database."""
        try:
            if self.provider == "qdrant" and self._qdrant_client:
                self._qdrant_client.delete_collection(self.collection_name)
                self._init_store()
            elif self._chroma_store:
                self._chroma_store.delete_collection()
                self._init_store()
        except Exception as e:
            print(f"Error resetting collection: {e}")


def get_vector_manager() -> VectorStoreManager:
    return VectorStoreManager.get_instance()
