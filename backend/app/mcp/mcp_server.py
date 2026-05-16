"""
MCP server facade for in-process tool discovery and execution.
"""
from __future__ import annotations

import logging
from typing import Any

from app.mcp.tool_registry import MCPToolRegistry
from app.tools.arxiv_tool import register_arxiv_tools
from app.tools.rag_tool import register_rag_tools
from app.tools.sql_tool import register_sql_tools
from app.tools.sheets_tool import register_sheet_tools
from app.tools.game_tool import register_game_tools
from app.tools.image_tool import register_image_tools
from app.tools.memory_tool import register_memory_tools


logger = logging.getLogger(__name__)


class MCPServer:
    def __init__(self, registry: MCPToolRegistry) -> None:
        self.registry = registry
        logger.info("[MCP] Server initialized")

    async def list_tools(self) -> dict[str, Any]:
        tools = self.registry.list_tools()
        logger.info("[MCP] Tool discovery requested: %s tools available", len(tools))
        return {"ok": True, "tools": tools}

    async def call_tool(self, tool_name: str, args: dict[str, Any]) -> dict[str, Any]:
        try:
            logger.info("[MCP] Executing tool: %s", tool_name)
            result = await self.registry.execute(tool_name, args)
            logger.info("[MCP] Tool success: %s", tool_name)
            return {"ok": True, "tool": tool_name, "result": result}
        except Exception as exc:
            logger.exception("[MCP] Tool failed: %s", tool_name)
            return {"ok": False, "tool": tool_name, "error": str(exc)}


_SERVER: MCPServer | None = None


def _build_registry() -> MCPToolRegistry:
    registry = MCPToolRegistry()
    register_arxiv_tools(registry)
    register_rag_tools(registry)
    register_sql_tools(registry)
    register_sheet_tools(registry)
    register_game_tools(registry)
    register_image_tools(registry)
    register_memory_tools(registry)
    logger.info("[MCP] Registry boot complete")
    return registry


def get_mcp_server() -> MCPServer:
    global _SERVER
    if _SERVER is None:
        _SERVER = MCPServer(_build_registry())
    return _SERVER
