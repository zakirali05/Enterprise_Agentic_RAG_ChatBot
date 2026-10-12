"""
Document Ingestion & Processing Service
=======================================
Handles document loading (PDF, Markdown, TXT, CSV), recursive semantic chunking,
metadata enrichment, and indexing into the ChromaDB vector store with nomic-embed-text.
"""

import os
import io
import time
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path
from pypdf import PdfReader
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.config import settings
from app.core.vector_store import get_vector_manager


class DocumentService:
    """
    Manages document parsing, chunking with nomic-embed-text embeddings, and indexing.
    """

    def __init__(self):
        self.vector_manager = get_vector_manager()
        # Recursive text splitter respects paragraphs, lines, and sentence boundaries
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP,
            separators=["\n\n", "\n", ". ", "? ", "! ", " ", ""],
            keep_separator=True,
        )

    def extract_text_from_pdf(self, file_bytes: bytes, filename: str) -> List[Dict[str, Any]]:
        """
        Extracts text from PDF bytes page-by-page to retain page numbering metadata.
        
        Args:
            file_bytes: Raw binary bytes of PDF file.
            filename: Source file name.
            
        Returns:
            List of page dicts with page_number and text.
        """
        reader = PdfReader(io.BytesIO(file_bytes))
        pages_data = []
        for idx, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            if text.strip():
                pages_data.append({
                    "page_number": idx + 1,
                    "text": text.strip()
                })
        return pages_data

    def process_and_index_file(
        self,
        filename: str,
        content_bytes: bytes,
        category: str = "Corporate Knowledge",
    ) -> Dict[str, Any]:
        """
        Parses an uploaded file, splits it into chunks, enriches metadata, and indexes into ChromaDB.
        
        Args:
            filename: Original file name (e.g. employee_handbook.pdf).
            content_bytes: File contents in bytes.
            category: Document classification category.
            
        Returns:
            Dict containing ingestion summary, chunk count, and metadata.
        """
        ext = Path(filename).suffix.lower()
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        file_size = len(content_bytes)

        # Save copy to upload directory
        clean_filename = Path(filename).name
        save_path = Path(settings.UPLOAD_DIR) / clean_filename
        with open(save_path, "wb") as f:
            f.write(content_bytes)

        raw_documents: List[Document] = []

        if ext == ".pdf":
            pages = self.extract_text_from_pdf(content_bytes, filename)
            for page in pages:
                doc = Document(
                    page_content=page["text"],
                    metadata={
                        "source": filename,
                        "filename": filename,
                        "page": page["page_number"],
                        "category": category,
                        "file_size": file_size,
                        "uploaded_at": now_str,
                    }
                )
                raw_documents.append(doc)
        else:
            # Text, Markdown, CSV, etc.
            text_str = content_bytes.decode("utf-8", errors="replace")
            doc = Document(
                page_content=text_str,
                metadata={
                    "source": filename,
                    "filename": filename,
                    "page": 1,
                    "category": category,
                    "file_size": file_size,
                    "uploaded_at": now_str,
                }
            )
            raw_documents.append(doc)

        # Apply RecursiveCharacterTextSplitter to create optimal chunks
        chunked_docs = self.text_splitter.split_documents(raw_documents)

        # Enrich chunk-specific metadata
        for idx, chunk in enumerate(chunked_docs):
            chunk.metadata["chunk_index"] = idx
            chunk.metadata["total_chunks"] = len(chunked_docs)
            chunk.metadata["char_count"] = len(chunk.page_content)

        # Index chunks into ChromaDB
        chunk_ids = self.vector_manager.add_documents(chunked_docs)

        return {
            "filename": filename,
            "category": category,
            "file_size_bytes": file_size,
            "chunks_created": len(chunked_docs),
            "chunk_ids_count": len(chunk_ids),
            "uploaded_at": now_str,
            "status": "success",
        }

    def process_raw_text(
        self,
        title: str,
        text: str,
        category: str = "Direct Note",
    ) -> Dict[str, Any]:
        """
        Indexes a raw text note or snippet into the knowledge base.
        """
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        doc = Document(
            page_content=text,
            metadata={
                "source": title,
                "filename": title,
                "page": 1,
                "category": category,
                "file_size": len(text.encode("utf-8")),
                "uploaded_at": now_str,
            }
        )
        chunked = self.text_splitter.split_documents([doc])
        for idx, chunk in enumerate(chunked):
            chunk.metadata["chunk_index"] = idx
            chunk.metadata["total_chunks"] = len(chunked)
            chunk.metadata["char_count"] = len(chunk.page_content)

        ids = self.vector_manager.add_documents(chunked)
        return {
            "filename": title,
            "category": category,
            "chunks_created": len(chunked),
            "uploaded_at": now_str,
            "status": "success",
        }

    def delete_document(self, filename: str) -> Dict[str, Any]:
        """Deletes a document and its chunks from vector store and disk."""
        deleted_count = self.vector_manager.delete_by_filename(filename)
        # Attempt to delete file from disk if present
        clean_filename = Path(filename).name
        disk_file = Path(settings.UPLOAD_DIR) / clean_filename
        if disk_file.exists():
            disk_file.unlink()
            
        return {
            "filename": filename,
            "deleted_chunks": deleted_count,
            "status": "deleted"
        }

    def seed_enterprise_sample_knowledge(self) -> List[Dict[str, Any]]:
        """
        Seeds rich, real-world enterprise documents into the knowledge base
        for instant testing, evaluation, and demonstration on resumes.
        """
        sample_docs = [
            {
                "title": "Enterprise_AI_Governance_and_Security_Policy.md",
                "category": "Security & Compliance",
                "content": """# Enterprise AI Governance & Security Policy (v3.4 - 2026)
## 1. Executive Summary
This enterprise policy outlines strict data privacy, model governance, and ethical deployment guidelines for all AI agents, Large Language Models (LLMs), and Retrieval-Augmented Generation (RAG) systems across the organization.

## 2. Data Classification and Acceptable Use
- **Tier 1 (Public Data):** Can be processed through any approved LLM or external API.
- **Tier 2 (Internal Business Data):** Must be processed strictly using self-hosted, air-gapped models (e.g. Ollama local models such as Qwen and nomic-embed-text) or SOC-2 compliant private endpoints.
- **Tier 3 (Confidential & PII):** Strictly forbidden from being forwarded to third-party multi-tenant SaaS APIs. Must utilize on-premise local vector stores (ChromaDB) with strict AES-256 encryption at rest.

## 3. Local Model Deployment Standards
- All on-premise inference engines must run with minimum 4-bit quantization (Q4_K_M) to maintain low latency (<150ms per token).
- Embedding models must support normalized cosine similarity matrices (such as nomic-embed-text with 768 dimensions).
- Hallucination monitoring: All enterprise responses must cite authoritative chunks with a minimum similarity score threshold of 0.35.

## 4. Model Fine-Tuning & Drift Detection
- Model evaluations must occur quarterly using automated synthetic benchmarks.
- In the event of model hallucination exceeding a 2.5% error rate, the system must fallback to verified human agent review.

## 5. Security Incident Response
Contact the Enterprise AI Security Operations Center at `ai-soc@enterprise-corp.internal` or extension #4490 for unauthorized data leakage or model jailbreak attempts."""
            },
            {
                "title": "Cloud_Architecture_and_SRE_Disaster_Recovery.md",
                "category": "Engineering & DevOps",
                "content": """# Cloud Infrastructure & SRE Disaster Recovery Guide (2026)
## 1. Architecture Overview
The Enterprise Copilot platform runs on a modern hybrid microservices architecture:
- **Frontend Layer:** Next.js 14 App Router, TypeScript, TailwindCSS, Server-Sent Events (SSE) consumer for real-time streaming tokens.
- **Backend API Gateway:** FastAPI asynchronous microservice, Python 3.14, Uvicorn worker pool.
- **Agent Orchestrator:** LangGraph state machine implementing Corrective RAG (CRAG) with query routing and fallback web search.
- **Vector Database:** ChromaDB local vector store with persistence directory mounted on high-speed NVMe storage.
- **Local Inference:** Ollama daemon serving Qwen-1.7B and nomic-embed-text.

## 2. Service Level Objectives (SLOs)
- **API Availability:** 99.95% uptime during business hours.
- **P95 Latency for First Token (TTFT):** < 850 milliseconds for cached embeddings; < 1.4 seconds for multi-hop agent routing.
- **RAG Retrieval Precision:** Precision@5 must remain above 88% on standardized corporate QA datasets.

## 3. High Availability and Failover Protocol
- In case of Ollama server degradation, the backend health probe triggers automated container restart within 15 seconds.
- Vector indices are backed up daily using snapshot sync to S3 cold storage (`s3://enterprise-backups-chroma/daily/`).
- If an agent detects zero relevant context chunks (relevance score < 0.30), it seamlessly executes Corrective RAG web fallback via DuckDuckGo without crashing."""
            },
            {
                "title": "Employee_Benefits_and_Workplace_Policies_2026.md",
                "category": "Human Resources",
                "content": """# Global Employee Benefits & Workplace Guidelines 2026
## 1. Remote Work & Flexible Hours
- Employees are eligible for flexible hybrid work with up to 4 days remote per week.
- Core business hours across all timezones are 10:00 AM to 3:00 PM local time for synchronous collaboration.
- Annual Home Office Stipend: $1,200 USD per employee for ergonomic furniture, high-speed fiber internet, and hardware upgrades.

## 2. Paid Time Off (PTO) & Leave Entitlements
- **Standard PTO:** 28 days of paid vacation per calendar year, accruing at 2.33 days per month.
- **Health & Mental Wellness Days:** 10 days of unrestricted sick and mental health leave per year.
- **Parental Leave:** 20 weeks of fully paid parental leave for primary and secondary caregivers, eligible within the first 12 months of birth or adoption.
- **Sabbatical Policy:** Employees with 4+ years of continuous service can take a 6-week sabbatical at 75% base salary.

## 3. Learning & Development Budget
- Every full-time employee receives $2,500 USD annual professional development budget for certifications (AWS, GCP, LangChain), AI engineering bootcamps, and technical books.
- Team members are granted 4 hours per week dedicated to internal R&D and open-source contributions.

## 4. Healthcare & Wellness Benefits
- 100% employer-covered premium health, dental, and vision insurance for employees and 80% coverage for dependents.
- Annual gym and wellness reimbursement: $75 per month."""
            }
        ]

        results = []
        for doc in sample_docs:
            res = self.process_raw_text(
                title=doc["title"],
                text=doc["content"],
                category=doc["category"],
            )
            results.append(res)
        return results


# Global accessor
def get_document_service() -> DocumentService:
    return DocumentService()
