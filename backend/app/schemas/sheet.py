"""Pydantic request models for sheet APIs."""
from __future__ import annotations

from pydantic import BaseModel, Field


class GoogleSheetImportRequest(BaseModel):
    url: str
    worksheet_name: str | None = None


class SheetQueryRequest(BaseModel):
    question: str = Field(min_length=1)
    sheet_id: str | None = None
    clear_history: bool = False
