"""
Research Digest Agent with real-time SSE streaming.

Autonomous research loop:
  1. Search arXiv with the user query.
  2. If sparse results, retry with simplified/refined query.
  3. Ask LLM whether a specific subtopic search would improve coverage.
  4. Stream a structured markdown research digest token by token.
"""
from __future__ import annotations

import json
from typing import AsyncGenerator

from openai import AsyncOpenAI

from app.core.config import settings
from app.mcp.mcp_client import get_mcp_client


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_client() -> AsyncOpenAI:
    key = settings.LITELLM_VIRTUAL_KEY or settings.LITELLM_API_KEY
    return AsyncOpenAI(api_key=key, base_url=settings.LITELLM_PROXY_URL)


def _event(event_type: str, **kwargs: object) -> str:
    return "data: " + json.dumps({"type": event_type, **kwargs}) + "\n\n"


def _papers_for_prompt(papers: list[dict]) -> str:
    lines: list[str] = []
    for i, p in enumerate(papers, 1):
        lines.append(f"[Paper {i}] {p.get('title', '')}")
        lines.append(f"Authors: {', '.join(p.get('authors', []))}")
        lines.append(f"Published: {p.get('published', '')}")
        lines.append(f"Abstract: {str(p.get('summary', ''))[:900]}")
        lines.append(f"URL: {p.get('arxiv_url', '')}")
        lines.append("")
    return "\n".join(lines)


async def _search_arxiv_via_mcp(query: str, max_results: int) -> list[dict]:
    client = get_mcp_client()
    await client.discover_tools()
    payload = await client.call_tool(
        "arxiv.search",
        {"query": query, "max_results": max_results, "sort_by": "relevance"},
    )
    result = payload.get("result") or {}
    papers = result.get("papers") or []
    return papers if isinstance(papers, list) else []


def _history_messages(history: list[dict[str, str]]) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for item in history[-6:]:
        role = item.get("role", "user")
        content = item.get("content", "").strip()
        if content:
            out.append({"role": role, "content": content})
    return out


_DIGEST_SYSTEM = """\
You are an expert AI research analyst. Generate a comprehensive, structured research digest \
using the papers provided.

Format your response as markdown with exactly these sections:

## Topic Overview
*One concise paragraph describing the research area and why it matters.*

## Key Findings
*Bulleted list of the most important findings, citing paper titles inline.*

## Important Papers
*For each notable paper: title in bold, 1-2 sentence analysis.*

## Technical Insights
*Deep technical details, methodologies, architectures discovered.*

## Research Trends
*Patterns, emerging directions, and consensus themes across the papers.*

## Limitations & Challenges
*Honest assessment of what the research has not solved yet.*

## Future Scope
*Promising directions for future work.*

## Summary
*Concise 2-3 paragraph synthesis of everything above.*

Rules:
- Be specific and cite paper titles.
- Use precise technical language.
- Do not invent information not in the abstracts.
- Keep each section focused and substantive.
"""


# ---------------------------------------------------------------------------
# Main streaming generator
# ---------------------------------------------------------------------------

async def stream_research_digest(
    query: str,
    history: list[dict[str, str]],
) -> AsyncGenerator[str, None]:
    """
    Async generator yielding SSE-formatted event strings.
    Yields: progress | papers | token | done | error
    """

    # ── Phase 1: Initial search ────────────────────────────────────────────
    yield _event("progress", stage="searching", message=f"Searching arXiv for '{query}'…")

    try:
        papers = await _search_arxiv_via_mcp(query, max_results=8)
    except Exception as exc:
        yield _event("error", message=f"arXiv search failed: {exc}")
        return

    # ── Phase 2: Retry with simplified query if sparse ────────────────────
    if len(papers) < 3:
        simplified = " ".join(query.split()[:4])
        yield _event("progress", stage="searching", message=f"Refining search: '{simplified}'…")
        try:
            extra = await _search_arxiv_via_mcp(simplified, max_results=6)
            # Tool already deduplicates; keep unique list by entry_id as final guard.
            seen: set[str] = set()
            merged: list[dict] = []
            for paper in papers + extra:
                pid = str(paper.get("entry_id", ""))
                if pid and pid not in seen:
                    seen.add(pid)
                    merged.append(paper)
            papers = merged
        except Exception:
            pass

    if not papers:
        yield _event(
            "error",
            message="No papers found on arXiv for this query. Try a more specific topic.",
        )
        return

    yield _event("papers", papers=papers[:10])
    yield _event(
        "progress",
        stage="analyzing",
        message=f"Found {len(papers)} papers. Evaluating coverage…",
    )

    # ── Phase 3: Optional LLM-driven subtopic refinement ──────────────────
    if len(papers) >= 4:
        client = _get_client()
        titles_sample = "; ".join(str(p.get("title", "")) for p in papers[:5])
        check_prompt = (
            f"Research query: {query}\n"
            f"Initial papers found: {titles_sample}\n\n"
            "Should I search an additional specific subtopic to complete this digest? "
            "If yes, output ONLY one short refined arXiv search query (under 10 words). "
            "If the current papers are sufficient, output only: SUFFICIENT"
        )
        try:
            check = await client.chat.completions.create(
                model=settings.LLM_MODEL,
                messages=[{"role": "user", "content": check_prompt}],
                temperature=0,
                max_tokens=64,
            )
            decision = (check.choices[0].message.content or "").strip()
            if decision and "SUFFICIENT" not in decision.upper() and len(decision) < 120:
                yield _event(
                    "progress",
                    stage="searching",
                    message=f"Supplemental search: '{decision[:60]}'…",
                )
                try:
                    extra2 = await _search_arxiv_via_mcp(decision, max_results=5)
                    seen: set[str] = set()
                    merged: list[dict] = []
                    for paper in papers + extra2:
                        pid = str(paper.get("entry_id", ""))
                        if pid and pid not in seen:
                            seen.add(pid)
                            merged.append(paper)
                    papers = merged[:15]
                    if extra2:
                        yield _event("papers", papers=papers)
                except Exception:
                    pass
        except Exception:
            pass  # refinement is optional; proceed without it

    # ── Phase 4: Stream digest ─────────────────────────────────────────────
    yield _event("progress", stage="generating", message="Generating structured research digest…")

    papers_text = _papers_for_prompt(papers[:12])
    messages = [
        {"role": "system", "content": _DIGEST_SYSTEM},
        *_history_messages(history),
        {
            "role": "user",
            "content": (
                f"Research query: {query}\n\n"
                f"Papers retrieved from arXiv:\n\n{papers_text}\n\n"
                "Generate a comprehensive structured research digest."
            ),
        },
    ]

    client = _get_client()
    full_tokens: list[str] = []

    try:
        stream = await client.chat.completions.create(
            model=settings.LLM_MODEL,
            messages=messages,
            stream=True,
            temperature=0.3,
            max_tokens=2500,
        )
        async for chunk in stream:
            token = chunk.choices[0].delta.content or ""
            if token:
                full_tokens.append(token)
                yield _event("token", content=token)
    except Exception as exc:
        err = str(exc)
        if "budget_exceeded" in err or "Budget has been exceeded" in err:
            yield _event(
                "error",
                message="AI budget exhausted — contact your admin to top up the LiteLLM quota.",
            )
        else:
            yield _event("error", message=f"Digest generation failed: {exc}")
        return

    yield _event("done", digest="".join(full_tokens), paper_count=len(papers))
