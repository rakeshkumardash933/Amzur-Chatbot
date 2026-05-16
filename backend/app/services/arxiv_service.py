"""
arXiv paper search and retrieval service.
Supports keyword search, latest-paper retrieval, and metadata extraction.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any

import arxiv


@dataclass
class ArxivPaper:
    entry_id: str
    title: str
    authors: list[str]
    summary: str
    published: str
    updated: str
    arxiv_url: str
    pdf_url: str
    categories: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "entry_id": self.entry_id,
            "title": self.title,
            "authors": self.authors,
            "summary": self.summary,
            "published": self.published,
            "updated": self.updated,
            "arxiv_url": self.arxiv_url,
            "pdf_url": self.pdf_url,
            "categories": self.categories,
        }


def _result_to_paper(result: arxiv.Result) -> ArxivPaper:
    return ArxivPaper(
        entry_id=result.entry_id,
        title=(result.title or "").strip(),
        authors=[a.name for a in result.authors[:6]],
        summary=(result.summary or "").strip()[:1500],
        published=result.published.strftime("%Y-%m-%d") if result.published else "",
        updated=result.updated.strftime("%Y-%m-%d") if result.updated else "",
        arxiv_url=result.entry_id or "",
        pdf_url=result.pdf_url or "",
        categories=list(result.categories or [])[:5],
    )


def search_papers_sync(
    query: str,
    max_results: int = 5,
    sort_by: arxiv.SortCriterion = arxiv.SortCriterion.Relevance,
) -> list[ArxivPaper]:
    """Synchronous arXiv paper search."""
    client = arxiv.Client(num_retries=2, delay_seconds=1)
    search = arxiv.Search(
        query=query,
        max_results=max_results,
        sort_by=sort_by,
        sort_order=arxiv.SortOrder.Descending,
    )
    papers: list[ArxivPaper] = []
    try:
        for result in client.results(search):
            papers.append(_result_to_paper(result))
    except Exception:
        pass
    return papers


async def search_papers(
    query: str,
    max_results: int = 5,
    sort_by: arxiv.SortCriterion = arxiv.SortCriterion.Relevance,
) -> list[ArxivPaper]:
    """Async arXiv paper search."""
    return await asyncio.to_thread(search_papers_sync, query, max_results, sort_by)


async def search_latest(query: str, max_results: int = 5) -> list[ArxivPaper]:
    """Search for most recently submitted papers."""
    return await search_papers(query, max_results, arxiv.SortCriterion.SubmittedDate)


def deduplicate(papers: list[ArxivPaper]) -> list[ArxivPaper]:
    """Remove duplicate papers by normalized arXiv ID."""
    seen: set[str] = set()
    unique: list[ArxivPaper] = []
    for p in papers:
        # Strip version suffix (e.g. 2312.00001v2 -> 2312.00001)
        raw_id = p.entry_id.rstrip("/").split("/")[-1]
        base_id = raw_id.split("v")[0]
        if base_id not in seen:
            seen.add(base_id)
            unique.append(p)
    return unique
