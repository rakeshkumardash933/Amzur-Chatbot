"""
Internal MCP-compatible tool registry.
Provides tool metadata, discovery, input validation, and async execution.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any, Awaitable, Callable

ToolHandler = Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]


@dataclass
class MCPTool:
    name: str
    description: str
    input_schema: dict[str, Any]
    output_schema: dict[str, Any]
    handler: ToolHandler


class MCPToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, MCPTool] = {}

    def register(self, tool: MCPTool) -> None:
        self._tools[tool.name] = tool

    def has(self, name: str) -> bool:
        return name in self._tools

    def get(self, name: str) -> MCPTool:
        tool = self._tools.get(name)
        if not tool:
            raise ValueError(f"Tool '{name}' not registered")
        return tool

    def list_tools(self) -> list[dict[str, Any]]:
        return [
            {
                "name": tool.name,
                "description": tool.description,
                "input_schema": tool.input_schema,
                "output_schema": tool.output_schema,
            }
            for tool in self._tools.values()
        ]

    @staticmethod
    def _validate_input(schema: dict[str, Any], args: dict[str, Any]) -> None:
        if not isinstance(args, dict):
            raise ValueError("Tool args must be a JSON object")

        required = schema.get("required", [])
        for key in required:
            if key not in args:
                raise ValueError(f"Missing required input field: {key}")

    async def execute(self, name: str, args: dict[str, Any], timeout_seconds: float = 30.0) -> dict[str, Any]:
        tool = self.get(name)
        self._validate_input(tool.input_schema, args)
        return await asyncio.wait_for(tool.handler(args), timeout=timeout_seconds)
