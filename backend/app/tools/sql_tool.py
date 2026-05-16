"""MCP tool wrappers for SQL querying."""
from __future__ import annotations

from typing import Any

from openai import AsyncOpenAI

from app.core.config import settings
from app.db.session import SessionLocal
from app.mcp.tool_registry import MCPTool, MCPToolRegistry
from app.services.database_query_service import execute_query, generate_sql, get_schema_summary, is_safe_query


def _client() -> AsyncOpenAI:
    key = settings.LITELLM_VIRTUAL_KEY or settings.LITELLM_API_KEY
    return AsyncOpenAI(api_key=key, base_url=settings.LITELLM_PROXY_URL)


async def _sql_nl_query(args: dict[str, Any]) -> dict[str, Any]:
    question = str(args.get("question", "")).strip()
    if not question:
        raise ValueError("question is required")

    history = args.get("history") or []
    schema = get_schema_summary()
    sql = await generate_sql(question, schema, history, _client(), settings.LLM_MODEL)

    if sql.strip().upper() == "CANNOT_ANSWER":
        return {"success": False, "error": "CANNOT_ANSWER", "sql": ""}

    ok, reason = is_safe_query(sql)
    if not ok:
        return {"success": False, "error": reason, "sql": sql}

    with SessionLocal() as db:
        result = execute_query(sql, db)
    return {"success": True, "sql": sql, "result": result}


async def _sql_execute_select(args: dict[str, Any]) -> dict[str, Any]:
    sql = str(args.get("sql", "")).strip()
    if not sql:
        raise ValueError("sql is required")

    ok, reason = is_safe_query(sql)
    if not ok:
        raise ValueError(reason)

    with SessionLocal() as db:
        result = execute_query(sql, db)
    return {"result": result}


def register_sql_tools(registry: MCPToolRegistry) -> None:
    registry.register(
        MCPTool(
            name="sql.natural_language_query",
            description="Convert NL question to safe SQL and execute it.",
            input_schema={"type": "object", "required": ["question"], "properties": {"question": {"type": "string"}, "history": {"type": "array"}}},
            output_schema={"type": "object", "properties": {"success": {"type": "boolean"}, "sql": {"type": "string"}, "result": {"type": "object"}, "error": {"type": "string"}}},
            handler=_sql_nl_query,
        )
    )

    registry.register(
        MCPTool(
            name="sql.execute_select",
            description="Execute a validated SELECT SQL query.",
            input_schema={"type": "object", "required": ["sql"], "properties": {"sql": {"type": "string"}}},
            output_schema={"type": "object", "properties": {"result": {"type": "object"}}},
            handler=_sql_execute_select,
        )
    )
