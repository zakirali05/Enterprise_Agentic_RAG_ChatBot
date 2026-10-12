"""
Unified LLM Client Integration Module
=====================================
Supports both ultra-fast Groq LPU inference and local Ollama inference:
- Groq (llama-3.3-70b-versatile, qwen/qwen3.8-27b, openai/gpt-oss-120b)
- Ollama (qwen3:1.7b)
"""

import httpx
from typing import Optional, Dict, Any, List, AsyncGenerator
from app.config import settings

# LangChain LLMs
from langchain_groq import ChatGroq
from langchain_ollama import ChatOllama


def get_chat_llm(temperature: Optional[float] = None, streaming: bool = False):
    """
    Returns an initialized LangChain Chat model.
    Prioritizes Groq if GROQ_API_KEY is configured, else falls back to local Ollama.
    """
    temp = temperature if temperature is not None else settings.TEMPERATURE

    if settings.GROQ_API_KEY:
        # Use Groq Cloud LPU
        model = settings.GROQ_MODEL or "qwen/qwen3.8-27b"
        return ChatGroq(
            api_key=settings.GROQ_API_KEY,
            model=model,
            temperature=temp,
            max_tokens=settings.MAX_TOKENS,
            streaming=streaming,
        )

    # Fallback: Local Ollama
    return ChatOllama(
        base_url=settings.OLLAMA_BASE_URL,
        model=settings.LLM_MODEL,
        temperature=temp,
        num_predict=settings.MAX_TOKENS,
        streaming=streaming,
    )


async def stream_chat_completion(
    messages: List[Dict[str, str]],
    temperature: float = 0.2,
) -> AsyncGenerator[str, None]:
    """
    Asynchronous streaming generator for tokens.
    Uses Groq Async client if GROQ_API_KEY is present for sub-50ms TTFT,
    otherwise uses Ollama Async client.
    """
    if settings.GROQ_API_KEY:
        from groq import AsyncGroq
        client = AsyncGroq(api_key=settings.GROQ_API_KEY)
        model = settings.GROQ_MODEL or "qwen/qwen3.8-27b"
        stream = await client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=settings.MAX_TOKENS,
            stream=True,
        )
        async for chunk in stream:
            token = chunk.choices[0].delta.content or ""
            if token:
                yield token
    else:
        import ollama
        client = ollama.AsyncClient(host=settings.OLLAMA_BASE_URL)
        stream_resp = await client.chat(
            model=settings.LLM_MODEL,
            messages=messages,
            stream=True,
            think=False,
            options={
                "temperature": temperature,
                "num_predict": settings.MAX_TOKENS,
            }
        )
        async for chunk in stream_resp:
            token = chunk.get("message", {}).get("content", "")
            if token:
                yield token


async def check_llm_health() -> Dict[str, Any]:
    """
    Verifies LLM availability across Groq or Ollama.
    """
    if settings.GROQ_API_KEY:
        from groq import Groq
        try:
            client = Groq(api_key=settings.GROQ_API_KEY)
            models = client.models.list()
            model_names = [m.id for m in models.data]
            active_model = settings.GROQ_MODEL if settings.GROQ_MODEL in model_names else "qwen/qwen3.8-27b"
            return {
                "provider": "groq",
                "connected": True,
                "model": active_model,
                "available_models": model_names[:5],
                "endpoint": "https://api.groq.com",
            }
        except Exception as e:
            return {
                "provider": "groq",
                "connected": False,
                "error": str(e),
            }

    # Ollama Health
    from app.core.ollama_client import check_ollama_health
    status = await check_ollama_health()
    status["provider"] = "ollama"
    status["model"] = settings.LLM_MODEL
    return status
