"""
Database query API routes — Natural Language to SQL.
All endpoints require authentication.
"""
import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from openai import AsyncOpenAI
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.config import settings
from app.db.session import get_db_session
from app.models import User
from app.services.database_query_service import (
    execute_query,
    explain_results,
    generate_sql,
    get_schema_summary,
    is_safe_query,
    invalidate_schema_cache,
)

router = APIRouter(prefix="/api/database", tags=["database"])

# In-memory conversation history per user (keyed by user_id, list of role/content dicts).
# A lightweight approach that avoids a new DB table.
_CONVERSATION_HISTORY: dict[int, list[dict]] = {}
_QUERY_HISTORY: dict[int, list[dict]] = {}  # recent queries per user


def _get_client() -> AsyncOpenAI:
    key = settings.LITELLM_VIRTUAL_KEY or settings.LITELLM_API_KEY
    return AsyncOpenAI(api_key=key, base_url=settings.LITELLM_PROXY_URL)


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class DatabaseQueryRequest(BaseModel):
    question: str
    clear_history: bool = False


# ---------------------------------------------------------------------------
# GET /api/database/schema
# ---------------------------------------------------------------------------

@router.get("/schema")
async def get_schema(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> dict:
    """Return a human-readable summary of the database schema."""
    try:
        schema = get_schema_summary()
        return {"success": True, "schema": schema}
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read schema: {exc}",
        )


# ---------------------------------------------------------------------------
# POST /api/database/query
# ---------------------------------------------------------------------------

@router.post("/query")
async def database_query(
    request: DatabaseQueryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> dict:
    """
    Convert a natural language question to SQL, execute it safely,
    and return the results with an AI-generated explanation.
    """
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="question is required")

    user_id = current_user.id

    if request.clear_history:
        _CONVERSATION_HISTORY[user_id] = []

    history = _CONVERSATION_HISTORY.get(user_id, [])
    schema = get_schema_summary()
    client = _get_client()

    # ── Step 1: Generate SQL ────────────────────────────────────────────────
    try:
        sql = await generate_sql(
            question=question,
            schema=schema,
            history=history,
            client=client,
            model=settings.LLM_MODEL,
        )
    except Exception as exc:
        err_str = str(exc)
        if "budget_exceeded" in err_str or "Budget has been exceeded" in err_str:
            raise HTTPException(
                status_code=402,
                detail="The organisation's AI budget has been exhausted. Contact your admin.",
            )
        raise HTTPException(status_code=500, detail=f"SQL generation failed: {exc}")

    # Normalise: strip markdown fences if LLM wrapped the SQL anyway
    sql = sql.strip().strip("`")
    if sql.lower().startswith("sql"):
        sql = sql[3:].strip()
    sql = sql.rstrip(";").strip()

    if sql == "CANNOT_ANSWER" or not sql:
        return {
            "success": False,
            "question": question,
            "sql": None,
            "columns": [],
            "rows": [],
            "row_count": 0,
            "execution_time_ms": 0,
            "explanation": "I could not generate a SQL query for that question using the available schema.",
            "error": "CANNOT_ANSWER",
        }

    # ── Step 2: Safety check ────────────────────────────────────────────────
    safe, reason = is_safe_query(sql)
    if not safe:
        return {
            "success": False,
            "question": question,
            "sql": sql,
            "columns": [],
            "rows": [],
            "row_count": 0,
            "execution_time_ms": 0,
            "explanation": None,
            "error": f"Query blocked: {reason}",
        }

    # ── Step 3: Execute ─────────────────────────────────────────────────────
    result = execute_query(sql, db)

    # ── Step 4: Explain results ─────────────────────────────────────────────
    explanation = ""
    if not result["error"] and result["rows"]:
        try:
            explanation = await explain_results(
                question=question,
                sql=sql,
                columns=result["columns"],
                rows=result["rows"],
                client=client,
                model=settings.LLM_MODEL,
            )
        except Exception:
            explanation = ""

    # ── Step 5: Update conversation history ─────────────────────────────────
    history.append({"role": "user", "content": question})
    assistant_summary = f"Generated SQL: {sql}\nResult: {result['row_count']} row(s) returned."
    history.append({"role": "assistant", "content": assistant_summary})
    _CONVERSATION_HISTORY[user_id] = history[-20:]  # keep last 10 exchanges

    # ── Step 6: Save to query history ───────────────────────────────────────
    entry = {
        "question": question,
        "sql": sql,
        "row_count": result["row_count"],
        "execution_time_ms": result["execution_time_ms"],
        "error": result["error"],
    }
    user_history = _QUERY_HISTORY.get(user_id, [])
    user_history.insert(0, entry)
    _QUERY_HISTORY[user_id] = user_history[:50]

    return {
        "success": True,
        "question": question,
        "sql": sql,
        "columns": result["columns"],
        "rows": result["rows"],
        "row_count": result["row_count"],
        "execution_time_ms": result["execution_time_ms"],
        "explanation": explanation,
        "error": result["error"],
    }


# ---------------------------------------------------------------------------
# GET /api/database/history
# ---------------------------------------------------------------------------

@router.get("/history")
async def query_history(
    current_user: User = Depends(get_current_user),
) -> dict:
    """Return the last 50 queries executed by the current user."""
    history = _QUERY_HISTORY.get(current_user.id, [])
    return {"success": True, "history": history}


# ---------------------------------------------------------------------------
# POST /api/database/clear-history
# ---------------------------------------------------------------------------

@router.post("/clear-history")
async def clear_history(
    current_user: User = Depends(get_current_user),
) -> dict:
    """Clear conversation and query history for the current user."""
    _CONVERSATION_HISTORY[current_user.id] = []
    _QUERY_HISTORY[current_user.id] = []
    return {"success": True}
