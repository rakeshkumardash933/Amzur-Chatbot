"""MCP tools for memory retrieval and chat history retrieval."""
from __future__ import annotations

from typing import Any

from sqlalchemy import select

from app.ai.memory import get_thread_memory_messages
from app.db.session import SessionLocal
from app.mcp.tool_registry import MCPTool, MCPToolRegistry
from app.models import Message


async def _memory_thread_context(args: dict[str, Any]) -> dict[str, Any]:
    chat_id = int(args.get("chat_id"))
    limit = int(args.get("limit", 5))
    limit = max(1, min(limit, 20))

    with SessionLocal() as db:
        msgs = get_thread_memory_messages(db, chat_id, limit=limit)
    serialized = [{"type": m.__class__.__name__, "content": str(m.content)} for m in msgs]
    return {"messages": serialized, "count": len(serialized)}


async def _chat_history(args: dict[str, Any]) -> dict[str, Any]:
    chat_id = int(args.get("chat_id"))
    limit = int(args.get("limit", 50))
    limit = max(1, min(limit, 200))

    with SessionLocal() as db:
        stmt = (
            select(Message)
            .where(Message.chat_id == chat_id)
            .order_by(Message.timestamp.desc(), Message.id.desc())
            .limit(limit)
        )
        rows = list(reversed(db.execute(stmt).scalars().all()))

    messages = [
        {
            "id": m.id,
            "sender": m.sender,
            "content": m.content,
            "timestamp": m.timestamp.isoformat(),
        }
        for m in rows
    ]
    return {"messages": messages, "count": len(messages)}


def register_memory_tools(registry: MCPToolRegistry) -> None:
    registry.register(
        MCPTool(
            name="memory.thread_context",
            description="Return thread memory window for a chat.",
            input_schema={"type": "object", "required": ["chat_id"], "properties": {"chat_id": {"type": "integer"}, "limit": {"type": "integer"}}},
            output_schema={"type": "object", "properties": {"messages": {"type": "array"}, "count": {"type": "integer"}}},
            handler=_memory_thread_context,
        )
    )

    registry.register(
        MCPTool(
            name="history.chat_messages",
            description="Return raw chat message history for a chat id.",
            input_schema={"type": "object", "required": ["chat_id"], "properties": {"chat_id": {"type": "integer"}, "limit": {"type": "integer"}}},
            output_schema={"type": "object", "properties": {"messages": {"type": "array"}, "count": {"type": "integer"}}},
            handler=_chat_history,
        )
    )
