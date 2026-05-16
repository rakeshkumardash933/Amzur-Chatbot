"""
Spreadsheet query API routes.
Supports CSV/XLSX upload and Google Sheets querying with conversational context.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
from uuid import uuid4

import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status

from app.core.auth import get_current_user
from app.core.config import settings
from app.models import User
from app.schemas.sheet import GoogleSheetImportRequest, SheetQueryRequest
from app.services.dataframe_agent_service import build_dataframe_preview, query_dataframe_agent
from app.services.sheets_service import SheetsServiceError, load_sheet_as_dataframe, load_uploaded_spreadsheet


router = APIRouter(prefix="/api/sheet", tags=["sheet"])

_ALLOWED_EXTENSIONS = {".csv", ".xlsx"}


@dataclass
class SheetSession:
    user_id: int
    dataframe: pd.DataFrame
    source_type: str
    source_name: str
    worksheet_name: str | None = None
    worksheet_names: list[str] = field(default_factory=list)
    history: list[dict[str, str]] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.utcnow)


_SESSIONS: dict[str, SheetSession] = {}
_ACTIVE_BY_USER: dict[int, str] = {}


def _new_session_id() -> str:
    return f"sheet_{uuid4().hex[:16]}"


def _max_upload_bytes() -> int:
    return max(1, settings.MAX_FILE_SIZE_MB) * 1024 * 1024


def _get_session_for_user(user_id: int, sheet_id: str | None) -> tuple[str, SheetSession]:
    resolved_id = sheet_id or _ACTIVE_BY_USER.get(user_id)
    if not resolved_id:
        raise HTTPException(status_code=404, detail="No active spreadsheet session found")

    session = _SESSIONS.get(resolved_id)
    if not session or session.user_id != user_id:
        raise HTTPException(status_code=404, detail="Spreadsheet session not found")

    return resolved_id, session


def _build_session_payload(sheet_id: str, session: SheetSession, limit: int = 10) -> dict[str, Any]:
    preview = build_dataframe_preview(session.dataframe, limit=limit)
    return {
        "success": True,
        "sheet_id": sheet_id,
        "source_type": session.source_type,
        "source_name": session.source_name,
        "worksheet_name": session.worksheet_name,
        "worksheet_names": session.worksheet_names,
        "preview": preview,
        "created_at": session.created_at.isoformat(),
    }


@router.post("/upload")
async def upload_sheet(
    file: UploadFile = File(...),
    worksheet_name: str | None = Form(None),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Upload CSV/XLSX and initialize spreadsheet query session."""
    filename = (file.filename or "").strip()
    if not filename:
        raise HTTPException(status_code=400, detail="File name is required")

    lower = filename.lower()
    if not any(lower.endswith(ext) for ext in _ALLOWED_EXTENSIONS):
        raise HTTPException(status_code=400, detail="Only .csv and .xlsx files are supported")

    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    if len(payload) > _max_upload_bytes():
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Max allowed size is {settings.MAX_FILE_SIZE_MB} MB",
        )

    try:
        loaded = load_uploaded_spreadsheet(payload, filename, worksheet_name=worksheet_name)
    except SheetsServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    sheet_id = _new_session_id()
    session = SheetSession(
        user_id=current_user.id,
        dataframe=loaded.dataframe,
        source_type="upload",
        source_name=loaded.source_name,
        worksheet_name=loaded.worksheet_name,
        worksheet_names=loaded.worksheet_names or [],
    )
    _SESSIONS[sheet_id] = session
    _ACTIVE_BY_USER[current_user.id] = sheet_id

    return _build_session_payload(sheet_id, session)


@router.post("/google")
async def import_google_sheet(
    request: GoogleSheetImportRequest,
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Load Google Sheets URL into a spreadsheet session."""
    sheet_url = request.url.strip()
    worksheet_name = request.worksheet_name

    if not sheet_url:
        raise HTTPException(status_code=400, detail="url is required")

    if worksheet_name is not None:
        worksheet_name = worksheet_name.strip() or None

    try:
        loaded = load_sheet_as_dataframe(sheet_url, worksheet_name=worksheet_name)
    except SheetsServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    sheet_id = _new_session_id()
    session = SheetSession(
        user_id=current_user.id,
        dataframe=loaded.dataframe,
        source_type="google",
        source_name=loaded.source_name,
        worksheet_name=loaded.worksheet_name,
        worksheet_names=loaded.worksheet_names or [],
    )
    _SESSIONS[sheet_id] = session
    _ACTIVE_BY_USER[current_user.id] = sheet_id

    return _build_session_payload(sheet_id, session)


@router.post("/query")
async def query_sheet(
    request: SheetQueryRequest,
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Run natural language query over the current spreadsheet session."""
    question = request.question.strip()
    sheet_id = request.sheet_id
    clear_history = request.clear_history

    resolved_id, session = _get_session_for_user(current_user.id, sheet_id)

    if session.dataframe.empty:
        raise HTTPException(status_code=400, detail="Spreadsheet is empty")

    if clear_history:
        session.history = []

    try:
        answer = await query_dataframe_agent(
            dataframe=session.dataframe,
            question=question,
            history=session.history,
        )
    except Exception as exc:
        err = str(exc)
        if "budget_exceeded" in err or "Budget has been exceeded" in err:
            raise HTTPException(
                status_code=402,
                detail="The organisation's AI budget has been exhausted. Contact your admin.",
            )
        raise HTTPException(status_code=500, detail=f"Sheet query failed: {exc}")

    session.history.append({"role": "user", "content": question})
    session.history.append({"role": "assistant", "content": answer})
    session.history = session.history[-20:]

    return {
        "success": True,
        "sheet_id": resolved_id,
        "question": question,
        "answer": answer,
        "history_count": len(session.history),
    }


@router.get("/preview")
async def sheet_preview(
    sheet_id: str | None = Query(default=None),
    limit: int = Query(default=10, ge=1, le=100),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Return spreadsheet preview: columns, rows, row_count, dtypes."""
    resolved_id, session = _get_session_for_user(current_user.id, sheet_id)
    return _build_session_payload(resolved_id, session, limit=limit)
