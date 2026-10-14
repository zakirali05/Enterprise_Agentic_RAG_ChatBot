"""
Document & Knowledge Base API Routes
====================================
Endpoints for file upload (PDF, TXT, MD), raw text snippet indexing,
document catalog inspection, and sample enterprise knowledge seeding.
"""

from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from pydantic import BaseModel, Field

from app.services.document_service import get_document_service
from app.core.vector_store import get_vector_manager

router = APIRouter(prefix="/api/documents", tags=["Knowledge Base & Documents"])


class TextNoteRequest(BaseModel):
    title: str = Field(..., min_length=1, description="Document title or note name")
    content: str = Field(..., min_length=1, description="Raw text content to chunk and index")
    category: Optional[str] = Field(default="Corporate Note", description="Category classification")


@router.get("")
def list_documents():
    """
    Returns all indexed documents with chunk count, file size, and upload timestamps.
    """
    vm = get_vector_manager()
    stats = vm.get_stats()
    return stats


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    category: Optional[str] = Form("Enterprise Knowledge"),
):
    """
    Uploads and indexes a document (PDF, TXT, Markdown, CSV) into the vector store with semantic embeddings.
    """
    service = get_document_service()
    
    # Read file content
    content_bytes = await file.read()
    if not content_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        result = service.process_and_index_file(
            filename=file.filename or "untitled_doc.txt",
            content_bytes=content_bytes,
            category=category or "Enterprise Knowledge",
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(e)}")


@router.post("/text")
def add_raw_text(note: TextNoteRequest):
    """
    Directly indexes a text note or pasted snippet into ChromaDB.
    """
    service = get_document_service()
    try:
        result = service.process_raw_text(
            title=note.title,
            text=note.content,
            category=note.category,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to index note: {str(e)}")


@router.delete("/{filename:path}")
def delete_document(filename: str):
    """
    Deletes all vector embeddings and chunks associated with the specified filename.
    """
    service = get_document_service()
    result = service.delete_document(filename)
    return result


@router.post("/seed")
def seed_sample_knowledge():
    """
    Seeds the knowledge base with enterprise policies:
    1. AI Governance & Security Policy
    2. Cloud Infrastructure & SRE Disaster Recovery
    3. Global Employee Benefits & Workplace Guidelines 2026
    """
    service = get_document_service()
    results = service.seed_enterprise_sample_knowledge()
    return {
        "status": "seeded",
        "documents_added": len(results),
        "details": results
    }
