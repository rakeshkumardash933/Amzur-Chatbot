"""
Natural Language to SQL service.
Converts plain-English questions into safe, read-only SQL queries using the LLM,
executes them against the configured PostgreSQL database, and returns structured results.
"""
import re
import time
from typing import Any, Optional

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session

from app.core.config import settings

# ---------------------------------------------------------------------------
# Safety: only SELECT statements are allowed
# ---------------------------------------------------------------------------

_BLOCKED = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|REPLACE|MERGE|EXEC|EXECUTE|GRANT|REVOKE|CALL)\b",
    re.IGNORECASE,
)


def is_safe_query(sql: str) -> tuple[bool, str]:
    """Return (True, '') if safe, else (False, reason)."""
    stripped = sql.strip().lstrip(";").strip()
    if not stripped.upper().startswith("SELECT"):
        return False, "Only SELECT queries are permitted."
    match = _BLOCKED.search(stripped)
    if match:
        return False, f"Blocked keyword '{match.group()}' detected."
    return True, ""


# ---------------------------------------------------------------------------
# Schema reader — cached per process lifetime
# ---------------------------------------------------------------------------

_SCHEMA_CACHE: Optional[str] = None


def get_schema_summary(engine=None) -> str:
    """
    Build a compact schema description: table → [col (type), …]
    Skips internal/system tables and alembic versioning.
    """
    global _SCHEMA_CACHE
    if _SCHEMA_CACHE:
        return _SCHEMA_CACHE

    if engine is None:
        engine = create_engine(settings.DATABASE_URL, future=True)

    insp = inspect(engine)
    skip = {"alembic_version", "spatial_ref_sys"}
    lines = []
    for table in insp.get_table_names():
        if table in skip:
            continue
        cols = insp.get_columns(table)
        col_desc = ", ".join(f"{c['name']} ({str(c['type']).split('(')[0]})" for c in cols)
        lines.append(f"  {table}: [{col_desc}]")

    _SCHEMA_CACHE = "Database schema:\n" + "\n".join(lines)
    return _SCHEMA_CACHE


def invalidate_schema_cache() -> None:
    global _SCHEMA_CACHE
    _SCHEMA_CACHE = None


# ---------------------------------------------------------------------------
# SQL generation via LLM
# ---------------------------------------------------------------------------

async def generate_sql(
    question: str,
    schema: str,
    history: list[dict],
    client,
    model: str,
) -> str:
    """
    Ask the LLM to produce a single SELECT SQL query for the given question.
    history is a list of {"role": "user"|"assistant", "content": str} dicts.
    """
    system_prompt = (
        "You are an expert PostgreSQL analyst. "
        "Given the database schema and the user's question, generate a single valid PostgreSQL SELECT query.\n"
        "Rules:\n"
        "- Output ONLY the raw SQL query — no markdown fences, no explanation, no trailing semicolons.\n"
        "- Use only SELECT. Never use INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, or any DML/DDL.\n"
        "- If you cannot answer with a SELECT query, output: CANNOT_ANSWER\n"
        "- Limit results to 200 rows unless the user specifies otherwise: append LIMIT 200.\n"
        "- Use proper table and column names from the schema below.\n\n"
        f"{schema}"
    )

    messages = [{"role": "system", "content": system_prompt}]
    for h in history[-6:]:  # last 3 exchanges for context
        messages.append(h)
    messages.append({"role": "user", "content": question})

    response = await client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0,
        max_tokens=512,
    )
    return (response.choices[0].message.content or "").strip()


# ---------------------------------------------------------------------------
# Execute SQL
# ---------------------------------------------------------------------------

def execute_query(sql: str, db: Session) -> dict[str, Any]:
    """
    Execute a validated SELECT query and return rows + metadata.
    Hard timeout via statement_timeout (PostgreSQL-specific).
    """
    t0 = time.perf_counter()
    try:
        # 15-second query timeout
        db.execute(text("SET statement_timeout = 15000"))
        result = db.execute(text(sql))
        columns = list(result.keys())
        rows = [list(row) for row in result.fetchall()]
        elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)
        return {
            "columns": columns,
            "rows": rows,
            "row_count": len(rows),
            "execution_time_ms": elapsed_ms,
            "error": None,
        }
    except Exception as exc:
        elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)
        return {
            "columns": [],
            "rows": [],
            "row_count": 0,
            "execution_time_ms": elapsed_ms,
            "error": str(exc),
        }


# ---------------------------------------------------------------------------
# Result explanation via LLM
# ---------------------------------------------------------------------------

async def explain_results(
    question: str,
    sql: str,
    columns: list[str],
    rows: list[list],
    client,
    model: str,
) -> str:
    """Generate a short plain-English explanation of the query results."""
    preview_rows = rows[:10]
    preview = "\n".join(", ".join(str(v) for v in row) for row in preview_rows)
    truncated = f" (showing first 10 of {len(rows)})" if len(rows) > 10 else ""

    prompt = (
        f"The user asked: \"{question}\"\n"
        f"The SQL query executed was:\n{sql}\n\n"
        f"Columns: {', '.join(columns)}\n"
        f"Results{truncated}:\n{preview}\n\n"
        "Provide a concise 1–3 sentence plain-English explanation of what these results show. "
        "Highlight key figures or patterns."
    )
    response = await client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=200,
    )
    return (response.choices[0].message.content or "").strip()
