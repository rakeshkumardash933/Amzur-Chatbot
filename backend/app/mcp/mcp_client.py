"""
MCP client facade used by agents to discover and invoke tools dynamically.
"""
from __future__ import annotations

import logging
from typing import Any

from app.mcp.mcp_server import get_mcp_server


logger = logging.getLogger(__name__)


class MCPClient:
    def __init__(self) -> None:
        self._server = get_mcp_server()
        self._tool_cache: dict[str, dict[str, Any]] = {}
        logger.info("[MCP] Client initialized")

    async def discover_tools(self, refresh: bool = False) -> list[dict[str, Any]]:
        if self._tool_cache and not refresh:
            logger.info("[MCP] Client discovery cache hit: %s tools", len(self._tool_cache))
            return list(self._tool_cache.values())

        logger.info("[MCP] Client discovery cache refresh")
        payload = await self._server.list_tools()
        if not payload.get("ok"):
            logger.error("[MCP] Client discovery failed")
            raise RuntimeError("Failed to discover MCP tools")

        tools = payload.get("tools", [])
        self._tool_cache = {tool["name"]: tool for tool in tools}
        logger.info("[MCP] Client discovered %s tools", len(tools))
        return tools

    async def has_tool(self, name: str) -> bool:
        if not self._tool_cache:
            await self.discover_tools()
        return name in self._tool_cache

    async def call_tool(self, name: str, args: dict[str, Any]) -> dict[str, Any]:
        if not self._tool_cache:
            await self.discover_tools()

        if name not in self._tool_cache:
            logger.warning("[MCP] Tool not in cache, refreshing: %s", name)
            await self.discover_tools(refresh=True)
            if name not in self._tool_cache:
                logger.error("[MCP] Tool unavailable after refresh: %s", name)
                raise RuntimeError(f"MCP tool unavailable: {name}")

        logger.info("[MCP] Client calling tool: %s", name)
        payload = await self._server.call_tool(name, args)
        if not payload.get("ok"):
            logger.error("[MCP] Client tool call failed: %s", name)
            raise RuntimeError(payload.get("error") or f"Tool call failed: {name}")
        logger.info("[MCP] Client tool call succeeded: %s", name)
        return payload


_CLIENT: MCPClient | None = None


def get_mcp_client() -> MCPClient:
    global _CLIENT
    if _CLIENT is None:
        _CLIENT = MCPClient()
    return _CLIENT
