"""MCP tool wrapper for arXiv search."""
from __future__ import annotations

import logging
from typing import Any

import arxiv

from app.mcp.tool_registry import MCPTool, MCPToolRegistry
from app.services.arxiv_service import deduplicate, search_papers


logger = logging.getLogger(__name__)


async def _arxiv_search(args: dict[str, Any]) -> dict[str, Any]:
    query = str(args.get("query", "")).strip()
    if not query:
        raise ValueError("query is required")

    max_results = int(args.get("max_results", 8))
    max_results = max(1, min(max_results, 25))

    sort = str(args.get("sort_by", "relevance")).lower()
    sort_by = arxiv.SortCriterion.SubmittedDate if sort in {"latest", "submitted"} else arxiv.SortCriterion.Relevance

    logger.info("[MCP] arxiv.search invoked | query='%s' | max_results=%s | sort_by=%s", query, max_results, sort)

    papers = await search_papers(query, max_results=max_results, sort_by=sort_by)
    papers = deduplicate(papers)
    return {"papers": [p.to_dict() for p in papers], "count": len(papers)}


def register_arxiv_tools(registry: MCPToolRegistry) -> None:
    registry.register(
        MCPTool(
            name="arxiv.search",
            description="Search arXiv and return normalized paper metadata.",
            input_schema={
                "type": "object",
                "required": ["query"],
                "properties": {
                    "query": {"type": "string"},
                    "max_results": {"type": "integer", "minimum": 1, "maximum": 25},
                    "sort_by": {"type": "string", "enum": ["relevance", "latest", "submitted"]},
                },
            },
            output_schema={
                "type": "object",
                "properties": {
                    "papers": {"type": "array"},
                    "count": {"type": "integer"},
                },
            },
            handler=_arxiv_search,
        )
    )
