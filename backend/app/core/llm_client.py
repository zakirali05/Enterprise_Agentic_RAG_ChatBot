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


def _get_safe_max_tokens(model: str) -> int:
    """Caps max_tokens to prevent 429 OTPM (Output Tokens Per Minute) on preview models."""
    if "qwen" in model.lower():
        return min(settings.MAX_TOKENS, 500)
    return min(settings.MAX_TOKENS, 1024)


def get_chat_llm(temperature: Optional[float] = None, streaming: bool = False):
    """
    Returns an initialized LangChain Chat model with automated resilience fallbacks.
    Prioritizes Groq if GROQ_API_KEY is configured, else falls back to local Ollama.
    """
    temp = temperature if temperature is not None else settings.TEMPERATURE

    if settings.GROQ_API_KEY:
        primary_model = settings.GROQ_MODEL or "qwen/qwen3.8-27b"
        safe_tokens = _get_safe_max_tokens(primary_model)
        primary = ChatGroq(
            api_key=settings.GROQ_API_KEY,
            model=primary_model,
            temperature=temp,
            max_tokens=safe_tokens,
            streaming=streaming,
        )
        # Automatic resilience fallback if primary model hits 429 rate limits
        fallback_model = "openai/gpt-oss-120b" if "qwen" in primary_model.lower() else "openai/gpt-oss-20b"
        fallback = ChatGroq(
            api_key=settings.GROQ_API_KEY,
            model=fallback_model,
            temperature=temp,
            max_tokens=min(settings.MAX_TOKENS, 1024),
            streaming=streaming,
        )
        return primary.with_fallbacks([fallback])

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
    Uses Groq Async client if GROQ_API_KEY is present with automated OTPM failover,
    otherwise uses Ollama Async client.
    """
    if settings.GROQ_API_KEY:
        from groq import AsyncGroq
        client = AsyncGroq(api_key=settings.GROQ_API_KEY)
        primary_model = settings.GROQ_MODEL or "qwen/qwen3.8-27b"
        safe_tokens = _get_safe_max_tokens(primary_model)
        try:
            stream = await client.chat.completions.create(
                model=primary_model,
                messages=messages,
                temperature=temperature,
                max_tokens=safe_tokens,
                stream=True,
            )
            async for chunk in stream:
                token = chunk.choices[0].delta.content or ""
                if token:
                    yield token
        except Exception as exc:
            # If 429 rate limit or OTPM exceeded on preview model, automatically fail over to gpt-oss-120b
            if any(err_kw in str(exc).lower() for err_kw in ["429", "rate_limit", "tokens per minute", "otpm"]):
                fallback_model = "openai/gpt-oss-120b" if "qwen" in primary_model.lower() else "openai/gpt-oss-20b"
                print(f"⚠️ Groq rate limit on {primary_model}. Auto-failing over to {fallback_model}...")
                stream = await client.chat.completions.create(
                    model=fallback_model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=min(settings.MAX_TOKENS, 1024),
                    stream=True,
                )
                async for chunk in stream:
                    token = chunk.choices[0].delta.content or ""
                    if token:
                        yield token
            else:
                raise exc
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
