"""
Agent State Definition
======================
Defines the schema for LangGraph agent workflow execution, tracking
user query, chat history, document retrieval, CRAG relevance grading,
live web search fallback, citation attribution, and execution traces.
"""

from typing import List, Dict, Any, Optional
from typing_extensions import TypedDict
from langchain_core.messages import BaseMessage
from langchain_core.documents import Document


class Citation(TypedDict):
    """Structured citation metadata for source attribution."""
    id: int
    title: str
    source: str
    snippet: str
    page: int
    score: float
    category: str


class TraceStep(TypedDict):
    """Step execution log for agentic visibility in the UI timeline."""
    step: str
    title: str
    status: str  # "running", "completed", "skipped", "warning"
    details: str
    timestamp: float


class AgentState(TypedDict):
    """
    Main state dictionary passed through the LangGraph execution graph.
    """
    # User input and chat history
    query: str
    mode: str  # "auto", "rag", "web", "direct"
    messages: List[BaseMessage]
    
    # Intent classification
    intent: str  # "rag", "web_search", "direct_conversation"
    
    # Document retrieval and grading (CRAG)
    documents: List[Document]
    document_scores: List[float]
    graded_documents: List[Document]
    needs_web_search: bool
    
    # Web search results (fallback or real-time queries)
    web_results: List[Dict[str, str]]
    
    # Citations attached to the final response
    citations: List[Citation]
    
    # Execution traces for frontend live visualization
    traces: List[TraceStep]
    
    # Generated answer
    generation: str
