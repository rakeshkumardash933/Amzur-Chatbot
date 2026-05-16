"""MCP tool wrappers for spreadsheet querying."""
from __future__ import annotations

from typing import Any

from app.api import sheet as sheet_api
from app.mcp.tool_registry import MCPTool, MCPToolRegistry
from app.services.dataframe_agent_service import query_dataframe_agent


async def _query_active_sheet(args: dict[str, Any]) -> dict[str, Any]:
    user_id = int(args.get("user_id"))
    question = str(args.get("question", "")).strip()
    clear_history = bool(args.get("clear_history", False))

    if not question:
        raise ValueError("question is required")

    sheet_id = sheet_api._ACTIVE_BY_USER.get(user_id)
    if not sheet_id:
        raise ValueError("No active spreadsheet session")

    session = sheet_api._SESSIONS.get(sheet_id)
    if not session or session.user_id != user_id:
        raise ValueError("Spreadsheet session not found")

    if clear_history:
        session.history = []

    answer = await query_dataframe_agent(session.dataframe, question, session.history)

    session.history.append({"role": "user", "content": question})
    session.history.append({"role": "assistant", "content": answer})
    session.history = session.history[-20:]

    return {"sheet_id": sheet_id, "answer": answer, "history_count": len(session.history)}


def register_sheet_tools(registry: MCPToolRegistry) -> None:
    registry.register(
        MCPTool(
            name="sheets.query_active_session",
            description="Query the active spreadsheet session for a user.",
            input_schema={
                "type": "object",
                "required": ["user_id", "question"],
                "properties": {
                    "user_id": {"type": "integer"},
                    "question": {"type": "string"},
                    "clear_history": {"type": "boolean"},
                },
            },
            output_schema={"type": "object", "properties": {"sheet_id": {"type": "string"}, "answer": {"type": "string"}, "history_count": {"type": "integer"}}},
            handler=_query_active_sheet,
        )
    )
