"""
Enterprise Chat Service & Streaming SSE Engine
===============================================
Manages multi-session conversation histories, session persistence
(supporting Neon Serverless Postgres and local JSON fallback),
and real-time Server-Sent Events (SSE) token and trace streaming with Groq and Ollama.
"""

import os
import json
import time
import uuid
import asyncio
from pathlib import Path
from typing import List, Dict, Any, Optional, AsyncGenerator

from app.config import settings
from app.agent.graph import (
    router_node,
    route_decision,
    retrieve_node,
    grade_documents_node,
    crag_decision,
    web_search_node,
)
from app.agent.prompts import RAG_SYSTEM_PROMPT, DIRECT_SYSTEM_PROMPT
from app.core.llm_client import stream_chat_completion


class ChatService:
    """
    Manages chat sessions and streaming LangGraph workflow execution.
    Persists data in Neon Serverless Postgres if configured, or local JSON.
    """

    def __init__(self):
        self.sessions_dir = Path(settings.SESSIONS_DIR)
        self.sessions_dir.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _init_db(self):
        """Initializes PostgreSQL table if DATABASE_URL is configured."""
        if settings.DATABASE_URL:
            try:
                import psycopg2
                conn = psycopg2.connect(settings.DATABASE_URL)
                cur = conn.cursor()
                cur.execute("""
                CREATE TABLE IF NOT EXISTS chat_sessions (
                    id VARCHAR(128) PRIMARY KEY,
                    title VARCHAR(255),
                    created_at VARCHAR(64),
                    updated_at VARCHAR(64),
                    messages JSONB
                );
                """)
                conn.commit()
                conn.close()
                print("✅ Neon Serverless Postgres session storage active!")
            except Exception as e:
                print(f"⚠️ Could not initialize Postgres sessions table: {e}")

    def _get_session_path(self, session_id: str) -> Path:
        return self.sessions_dir / f"{session_id}.json"

    def list_sessions(self) -> List[Dict[str, Any]]:
        """Returns list of active chat sessions ordered by latest updated."""
        # 1. Try Neon Postgres
        if settings.DATABASE_URL:
            try:
                import psycopg2
                conn = psycopg2.connect(settings.DATABASE_URL)
                cur = conn.cursor()
                cur.execute("SELECT id, title, created_at, updated_at, messages FROM chat_sessions ORDER BY updated_at DESC LIMIT 50;")
                rows = cur.fetchall()
                conn.close()
                if rows is not None:
                    return [
                        {
                            "id": r[0],
                            "title": r[1] or "New Conversation",
                            "created_at": r[2] or "",
                            "updated_at": r[3] or "",
                            "message_count": len(r[4]) if r[4] else 0,
                        }
                        for r in rows
                        if (r[4] and len(r[4]) > 0) or (r[1] and r[1] != "New Conversation")
                    ]
            except Exception as e:
                print(f"⚠️ Postgres session read error ({e}), falling back to disk.")

        # 2. Local JSON Fallback
        sessions = []
        for file in self.sessions_dir.glob("*.json"):
            try:
                with open(file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    sessions.append({
                        "id": data.get("id", file.stem),
                        "title": data.get("title", "New Conversation"),
                        "created_at": data.get("created_at", ""),
                        "updated_at": data.get("updated_at", ""),
                        "message_count": len(data.get("messages", [])),
                    })
            except Exception:
                continue

        sessions.sort(key=lambda s: s.get("updated_at", ""), reverse=True)
        return sessions

    def get_session(self, session_id: str) -> Dict[str, Any]:
        """Loads a session's full message history or creates a new one."""
        # 1. Try Neon Postgres
        if settings.DATABASE_URL:
            try:
                import psycopg2
                conn = psycopg2.connect(settings.DATABASE_URL)
                cur = conn.cursor()
                cur.execute("SELECT id, title, created_at, updated_at, messages FROM chat_sessions WHERE id = %s;", (session_id,))
                row = cur.fetchone()
                conn.close()
                if row:
                    return {
                        "id": row[0],
                        "title": row[1] or "New Conversation",
                        "created_at": row[2] or "",
                        "updated_at": row[3] or "",
                        "messages": row[4] or [],
                    }
            except Exception as e:
                print(f"⚠️ Postgres session read error: {e}")

        # 2. Try Disk
        path = self._get_session_path(session_id)
        if path.exists():
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass

        # Create new session
        now = time.strftime("%Y-%m-%d %H:%M:%S")
        new_session = {
            "id": session_id,
            "title": "New Conversation",
            "created_at": now,
            "updated_at": now,
            "messages": [],
        }
        self.save_session(new_session)
        return new_session

    def save_session(self, session_data: Dict[str, Any]):
        """Persists session to Neon Postgres and disk cache."""
        now = time.strftime("%Y-%m-%d %H:%M:%S")
        session_data["updated_at"] = now

        # Save to Postgres
        if settings.DATABASE_URL:
            try:
                import psycopg2
                conn = psycopg2.connect(settings.DATABASE_URL)
                cur = conn.cursor()
                cur.execute("""
                INSERT INTO chat_sessions (id, title, created_at, updated_at, messages)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    title = EXCLUDED.title,
                    updated_at = EXCLUDED.updated_at,
                    messages = EXCLUDED.messages;
                """, (
                    session_data["id"],
                    session_data.get("title", "New Conversation"),
                    session_data.get("created_at", now),
                    now,
                    json.dumps(session_data.get("messages", [])),
                ))
                conn.commit()
                conn.close()
            except Exception as e:
                print(f"⚠️ Postgres session save error: {e}")

        # Save to disk cache
        try:
            path = self._get_session_path(session_data["id"])
            with open(path, "w", encoding="utf-8") as f:
                json.dump(session_data, f, indent=2, ensure_ascii=False)
        except Exception:
            pass

    def delete_session(self, session_id: str) -> bool:
        """Deletes a chat session."""
        success = False
        if settings.DATABASE_URL:
            try:
                import psycopg2
                conn = psycopg2.connect(settings.DATABASE_URL)
                cur = conn.cursor()
                cur.execute("DELETE FROM chat_sessions WHERE id = %s;", (session_id,))
                conn.commit()
                conn.close()
                success = True
            except Exception:
                pass

        path = self._get_session_path(session_id)
        if path.exists():
            path.unlink()
            success = True
        return success

    async def stream_agent_execution(
        self,
        query: str,
        session_id: str,
        mode: str = "auto",
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Executes the agentic workflow and yields SSE events:
        - {"type": "trace", "data": {...}}
        - {"type": "citations", "data": [...]}
        - {"type": "token", "data": {"text": "..."}}
        - {"type": "done", "data": {...}}
        """
        session = self.get_session(session_id)
        
        # If title is default, generate concise title from user query
        if session.get("title") == "New Conversation" or not session.get("messages"):
            clean_title = query.strip()[:35] + ("..." if len(query.strip()) > 35 else "")
            session["title"] = clean_title
            self.save_session(session)

        # Initialize State
        state = {
            "query": query,
            "mode": mode,
            "messages": [],
            "intent": "rag",
            "documents": [],
            "document_scores": [],
            "graded_documents": [],
            "needs_web_search": False,
            "web_results": [],
            "citations": [],
            "traces": [],
            "generation": "",
        }

        # Step 1: Routing
        route_update = router_node(state)
        state.update(route_update)
        latest_trace = state["traces"][-1]
        yield {"type": "trace", "data": latest_trace}
        await asyncio.sleep(0.05)

        branch = route_decision(state)

        # Step 2: Branching execution
        if branch == "retrieve_node":
            ret_update = retrieve_node(state)
            state.update(ret_update)
            yield {"type": "trace", "data": state["traces"][-1]}
            await asyncio.sleep(0.05)

            grade_update = grade_documents_node(state)
            state.update(grade_update)
            yield {"type": "trace", "data": state["traces"][-1]}
            await asyncio.sleep(0.05)

            # If CRAG triggers web search
            if crag_decision(state) == "web_search_node":
                web_update = web_search_node(state)
                state.update(web_update)
                yield {"type": "trace", "data": state["traces"][-1]}
                await asyncio.sleep(0.05)

        elif branch == "web_search_node":
            web_update = web_search_node(state)
            state.update(web_update)
            yield {"type": "trace", "data": state["traces"][-1]}
            await asyncio.sleep(0.05)

        # Step 3: Stream Citations as soon as they are determined
        if state.get("citations"):
            yield {"type": "citations", "data": state["citations"]}

        # Step 4: Stream Tokens from Groq or Ollama
        is_direct = (branch == "generate_direct_node")

        if is_direct:
            sys_msg = DIRECT_SYSTEM_PROMPT
        else:
            context_chunks = []
            doc_idx = 1
            for doc in state.get("graded_documents", []):
                meta = doc.metadata
                page = f", Page {meta.get('page', 1)}" if meta.get("page") else ""
                context_chunks.append(
                    f"[Doc {doc_idx}: {meta.get('filename', 'Enterprise Doc')}{page}]\n{doc.page_content.strip()}"
                )
                doc_idx += 1

            web_idx = 1
            for w in state.get("web_results", []):
                context_chunks.append(
                    f"[Web {web_idx}: {w['title']} ({w['url']})]\n{w['snippet'].strip()}"
                )
                web_idx += 1

            ctx_block = "\n\n".join(context_chunks) if context_chunks else "No specific document context found."
            sys_msg = RAG_SYSTEM_PROMPT.format(context_block=f"VERIFIED ENTERPRISE CONTEXT:\n{ctx_block}")

        provider_name = "Groq LPU" if settings.GROQ_API_KEY else "Qwen3:1.7B"
        model_name = settings.GROQ_MODEL if settings.GROQ_API_KEY else settings.LLM_MODEL
        gen_trace = {
            "step": "generator",
            "title": "Response Token Synthesis",
            "status": "running",
            "details": f"Streaming tokens via {provider_name} ({model_name}) with {len(state.get('citations', []))} citations",
            "timestamp": time.time(),
        }
        state["traces"].append(gen_trace)
        yield {"type": "trace", "data": gen_trace}

        # Build message history
        chat_messages = [{"role": "system", "content": sys_msg}]
        past_msgs = session.get("messages", [])[-4:]
        for m in past_msgs:
            role = "user" if m.get("role") == "user" else "assistant"
            chat_messages.append({"role": role, "content": m.get("content", "")})

        chat_messages.append({"role": "user", "content": query})

        full_generation = ""
        try:
            async for token in stream_chat_completion(
                messages=chat_messages,
                temperature=0.3 if is_direct else 0.15,
            ):
                full_generation += token
                yield {"type": "token", "data": {"text": token}}
        except Exception as e:
            err_msg = f"\n\n*(Error generating response with {provider_name}: {str(e)})*"
            full_generation += err_msg
            yield {"type": "token", "data": {"text": err_msg}}

        # Update generator trace to completed
        state["traces"][-1]["status"] = "completed"
        state["traces"][-1]["details"] = f"Completed stream via {provider_name} ({len(full_generation)} characters synthesized)"
        yield {"type": "trace", "data": state["traces"][-1]}

        # Save to session history
        session["messages"].append({
            "id": str(uuid.uuid4()),
            "role": "user",
            "content": query,
            "timestamp": time.time(),
        })
        session["messages"].append({
            "id": str(uuid.uuid4()),
            "role": "assistant",
            "content": full_generation,
            "citations": state.get("citations", []),
            "traces": state.get("traces", []),
            "mode": mode,
            "timestamp": time.time(),
        })
        self.save_session(session)

        # Yield completion payload
        yield {
            "type": "done",
            "data": {
                "generation": full_generation,
                "citations": state.get("citations", []),
                "traces": state.get("traces", []),
                "session_id": session_id,
            }
        }


def get_chat_service() -> ChatService:
    return ChatService()
