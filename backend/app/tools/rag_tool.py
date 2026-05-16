"""MCP tool wrapper for PDF RAG retrieval."""
from __future__ import annotations

from typing import Any

from sqlalchemy import select

from app.db.session import SessionLocal
from app.mcp.tool_registry import MCPTool, MCPToolRegistry
from app.models import Document
from app.services.pdf_service import pdf_service


async def _rag_retrieve(args: dict[str, Any]) -> dict[str, Any]:
    query = str(args.get("query", "")).strip()
    if not query:
        raise ValueError("query is required")

    user_id = args.get("user_id")
    document_ids = args.get("document_ids")
    n_results = int(args.get("n_results", 5))
    n_results = max(1, min(n_results, 10))

    with SessionLocal() as db:
        stmt = select(Document).where(Document.is_processed == True)  # noqa: E712
        if user_id is not None:
            stmt = stmt.where(Document.user_id == int(user_id))
        if document_ids:
            stmt = stmt.where(Document.id.in_([int(d) for d in document_ids]))

        docs = db.execute(stmt).scalars().all()
        collections = [d.collection_name for d in docs if d.collection_name]

    if not collections:
        return {"chunks": [], "count": 0}

    chunks = pdf_service.retrieve_chunks(query=query, collection_names=collections, n_results=n_results)
    return {"chunks": chunks, "count": len(chunks)}


def register_rag_tools(registry: MCPToolRegistry) -> None:
    registry.register(
        MCPTool(
            name="rag.retrieve_chunks",
            description="Retrieve relevant PDF chunks from ChromaDB.",
            input_schema={
                "type": "object",
                "required": ["query"],
                "properties": {
                    "query": {"type": "string"},
                    "user_id": {"type": "integer"},
                    "document_ids": {"type": "array"},
                    "n_results": {"type": "integer"},
                },
            },
            output_schema={"type": "object", "properties": {"chunks": {"type": "array"}, "count": {"type": "integer"}}},
            handler=_rag_retrieve,
        )
    )
