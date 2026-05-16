"""
Research Digest API routes — arXiv-powered agent with SSE streaming.
All endpoints require JWT authentication.
"""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.core.auth import get_current_user
from app.models import User
from app.agents.research_agent import stream_research_digest

router = APIRouter(prefix="/api/research", tags=["research"])

# Per-user in-memory stores (conversation history + query log)
_HISTORY: dict[int, list[dict]] = {}
_LOG: dict[int, list[dict]] = {}


class ResearchQueryRequest(BaseModel):
    query: str = Field(min_length=1)
    clear_history: bool = False


# ---------------------------------------------------------------------------
# POST /api/research/stream
# ---------------------------------------------------------------------------

@router.post("/stream")
async def research_stream(
    request: ResearchQueryRequest,
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    """
    Start an autonomous research session and stream the digest as SSE.

    Each chunk is a JSON-encoded event:
      {"type": "progress", "stage": "searching"|"analyzing"|"generating", "message": "..."}
      {"type": "papers",   "papers": [...]}
      {"type": "token",    "content": "..."}
      {"type": "done",     "digest": "...", "paper_count": N}
      {"type": "error",    "message": "..."}

    Followed by the terminal sentinel: data: [DONE]
    """
    query = request.query.strip()
    user_id = current_user.id

    if request.clear_history:
        _HISTORY[user_id] = []

    history = _HISTORY.get(user_id, [])

    async def generate():
        digest_parts: list[str] = []
        paper_count: int = 0

        async for event_str in stream_research_digest(query, history):
            yield event_str
            # Capture tokens + metadata for post-stream history update
            try:
                raw = event_str.removeprefix("data: ").strip()
                event = json.loads(raw)
                if event.get("type") == "token":
                    digest_parts.append(event.get("content", ""))
                elif event.get("type") == "done":
                    paper_count = int(event.get("paper_count", 0))
            except Exception:
                pass

        # Persist conversation memory after stream completes
        final_digest = "".join(digest_parts)
        if final_digest:
            history.append({"role": "user", "content": query})
            history.append({"role": "assistant", "content": final_digest[:1200]})
            _HISTORY[user_id] = history[-20:]

        # Persist to query log
        log = _LOG.get(user_id, [])
        log.insert(0, {"query": query, "paper_count": paper_count})
        _LOG[user_id] = log[:50]

        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ---------------------------------------------------------------------------
# GET /api/research/history
# ---------------------------------------------------------------------------

@router.get("/history")
async def research_history(
    current_user: User = Depends(get_current_user),
) -> dict:
    """Return the last 50 research queries for the current user."""
    return {"success": True, "history": _LOG.get(current_user.id, [])}


# ---------------------------------------------------------------------------
# POST /api/research/clear-history
# ---------------------------------------------------------------------------

@router.post("/clear-history")
async def clear_history(
    current_user: User = Depends(get_current_user),
) -> dict:
    """Clear conversation and query history for the current user."""
    _HISTORY[current_user.id] = []
    _LOG[current_user.id] = []
    return {"success": True}
