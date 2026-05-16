"""
Pandas DataFrame agent service.
Builds conversational Q&A over spreadsheets using LangChain's pandas agent.
"""
from __future__ import annotations

import asyncio
from typing import Any

import pandas as pd
from langchain.agents.agent_types import AgentType
from langchain_experimental.agents import create_pandas_dataframe_agent
from langchain_openai import ChatOpenAI

from app.core.config import settings


def _build_llm() -> ChatOpenAI:
    api_key = settings.LITELLM_VIRTUAL_KEY or settings.LITELLM_API_KEY
    return ChatOpenAI(
        model=settings.LLM_MODEL,
        temperature=0,
        api_key=api_key,
        openai_api_base=settings.LITELLM_PROXY_URL,
    )


def _history_prompt(history: list[dict[str, str]]) -> str:
    if not history:
        return ""
    recent = history[-8:]
    lines = ["Conversation context:"]
    for item in recent:
        role = item.get("role", "user")
        content = item.get("content", "").strip()
        if not content:
            continue
        lines.append(f"- {role}: {content}")
    return "\n".join(lines)


def _coerce_output(result: Any) -> str:
    if isinstance(result, dict):
        out = result.get("output")
        if isinstance(out, str) and out.strip():
            return out.strip()
        return str(result)
    if isinstance(result, str):
        return result.strip()
    return str(result)


async def query_dataframe_agent(
    dataframe: pd.DataFrame,
    question: str,
    history: list[dict[str, str]] | None = None,
) -> str:
    """Query a DataFrame with conversational context."""
    history = history or []
    llm = _build_llm()

    def _run() -> str:
        try:
            agent = create_pandas_dataframe_agent(
                llm,
                dataframe,
                verbose=False,
                agent_type=AgentType.OPENAI_FUNCTIONS,
                allow_dangerous_code=False,
            )
        except TypeError:
            agent = create_pandas_dataframe_agent(
                llm,
                dataframe,
                verbose=False,
                agent_type=AgentType.OPENAI_FUNCTIONS,
            )

        prompt = (
            "You are a spreadsheet analysis assistant. "
            "Use dataframe operations to answer accurately. "
            "When asked for top values, sort descending unless user specifies otherwise.\n\n"
            f"{_history_prompt(history)}\n\n"
            f"User question: {question}"
        ).strip()

        result = agent.invoke({"input": prompt})
        return _coerce_output(result)

    return await asyncio.to_thread(_run)


def build_dataframe_preview(dataframe: pd.DataFrame, limit: int = 10) -> dict[str, Any]:
    """Generate preview metadata for frontend table rendering."""
    limit = max(1, min(limit, 100))
    working = dataframe.copy()

    rows = (
        working.head(limit)
        .where(pd.notna(working.head(limit)), None)
        .to_dict(orient="records")
    )

    dtypes = {col: str(dtype) for col, dtype in working.dtypes.items()}
    missing_values = {
        col: int(count)
        for col, count in working.isna().sum().to_dict().items()
        if int(count) > 0
    }

    numeric_cols = [c for c in working.columns if pd.api.types.is_numeric_dtype(working[c])]
    categorical_cols = [c for c in working.columns if c not in numeric_cols]

    suggested_questions = [
        "Generate summary of this sheet",
        "What trends do you see?",
        "Show top 5 rows by the most important numeric column",
        "Count active records",
    ]
    if numeric_cols:
        suggested_questions.append(f"What is the total of {numeric_cols[0]}?")
        suggested_questions.append(f"What is the average of {numeric_cols[0]}?")
    if categorical_cols:
        suggested_questions.append(f"Show top 5 {categorical_cols[0]} values by frequency")

    markdown = ""
    if not working.empty:
        markdown = working.head(limit).to_markdown(index=False)

    return {
        "columns": [str(c) for c in working.columns.tolist()],
        "rows": rows,
        "row_count": int(len(working)),
        "dtypes": dtypes,
        "missing_values": missing_values,
        "markdown": markdown,
        "numeric_columns": numeric_cols,
        "categorical_columns": categorical_cols,
        "suggested_questions": suggested_questions[:8],
    }
