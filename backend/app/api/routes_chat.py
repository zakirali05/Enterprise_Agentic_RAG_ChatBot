"""
Chat API Routes
===============
Endpoints for session management and real-time Server-Sent Events (SSE) streaming.
"""

import json
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from app.services.chat_service import get_chat_service

router = APIRouter(prefix="/api/chat", tags=["Chat & Agent"])


class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1, description="User's query prompt")
    session_id: str = Field(..., description="Unique session/conversation UUID")
    mode: str = Field(
        default="auto",
        description="Execution mode: auto (Agentic CRAG), rag (Docs only), web (DuckDuckGo only), direct (Direct LLM)"
    )


@router.post("/stream")
async def stream_chat(req: ChatRequest):
    """
    Streams agent workflow steps, citations, and LLM tokens via Server-Sent Events (SSE).
    """
    service = get_chat_service()

    async def event_generator():
        try:
            async for item in service.stream_agent_execution(
                query=req.query,
                session_id=req.session_id,
                mode=req.mode,
            ):
                event_type = item.get("type", "message")
                payload = json.dumps(item.get("data", {}))
                yield {
                    "event": event_type,
                    "data": payload
                }
        except Exception as e:
            err_data = json.dumps({"error": str(e)})
            yield {"event": "error", "data": err_data}

    return EventSourceResponse(event_generator())


@router.get("/sessions")
def list_sessions():
    """Lists all conversation sessions ordered by most recently active."""
    service = get_chat_service()
    return {"sessions": service.list_sessions()}


@router.get("/sessions/{session_id}")
def get_session_history(session_id: str):
    """Retrieves full conversation history and metadata for a session."""
    service = get_chat_service()
    return service.get_session(session_id)


@router.delete("/sessions/{session_id}")
def delete_session(session_id: str):
    """Deletes a chat session and clears its history from disk."""
    service = get_chat_service()
    success = service.delete_session(session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "deleted", "session_id": session_id}
