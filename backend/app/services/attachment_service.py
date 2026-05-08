"""
Attachment service — file upload, security validation, and AI context extraction.

Supported files are stored under UPLOAD_DIR/<thread_id>/<uuid>_<safe_name>.
They are served as static files via FastAPI's StaticFiles mount at /uploads/.

AI context is built per file type:
  - Images   → base64 data-URL injected into a multimodal HumanMessage
    - CSV/TSV/Excel → pandas preview as markdown table
    - JSON/code/formula/text → raw text snippet
  - PDF       → extracted text pages (PyPDF2, optional)
    - Video     → metadata + representative frames injected as images
"""
from __future__ import annotations

import base64
import mimetypes
import re
import uuid
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import aiofiles
from fastapi import HTTPException, UploadFile
from langchain_core.messages import BaseMessage, HumanMessage
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Attachment

# ---------------------------------------------------------------------------
# Known type map (best-effort classification)
# ---------------------------------------------------------------------------

# Extension → MIME type used for server-side classification when known.
EXTENSION_MIME: Dict[str, str] = {
    # Images
    ".png":  "image/png",
    ".jpg":  "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    # Video
    ".mp4":  "video/mp4",
    ".mov":  "video/quicktime",
    ".webm": "video/webm",
    # Tabular
    ".csv":  "text/csv",
    ".tsv":  "text/tab-separated-values",
    ".xls":  "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".json": "application/json",
    # Code
    ".js":   "text/javascript",
    ".jsx":  "text/javascript",
    ".ts":   "text/typescript",
    ".tsx":  "text/typescript",
    ".py":   "text/x-python",
    ".java": "text/x-java-source",
    ".c":    "text/x-csrc",
    ".cpp":  "text/x-c++src",
    ".cs":   "text/x-csharp",
    ".go":   "text/x-go",
    ".rs":   "text/x-rustsrc",
    ".php":  "application/x-httpd-php",
    ".rb":   "application/x-ruby",
    ".r":    "text/x-rsrc",
    ".html": "text/html",
    ".css":  "text/css",
    ".sql":  "application/sql",
    ".yml":  "application/yaml",
    ".yaml": "application/yaml",
    ".ipynb": "application/x-ipynb+json",
    # Documents
    ".txt":  "text/plain",
    ".md":   "text/markdown",
    ".pdf":  "application/pdf",
    ".tex":  "application/x-tex",
    ".latex": "application/x-tex",
}

# Blocklist: never accept these regardless of content
BLOCKED_EXTENSIONS = {
    ".exe", ".bat", ".cmd", ".sh", ".ps1", ".msi", ".dll",
    ".so", ".bin", ".com", ".scr", ".vbs", ".pif",
}

MAX_BYTES = settings.MAX_FILE_SIZE_MB * 1024 * 1024


def _uploads_root() -> Path:
    """Resolve UPLOAD_DIR to an absolute path anchored at backend root."""
    configured = Path(settings.UPLOAD_DIR)
    if configured.is_absolute():
        return configured
    backend_root = Path(__file__).resolve().parents[2]  # .../backend
    return (backend_root / configured).resolve()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _sanitize_filename(raw: str) -> str:
    """Strip path components and replace unsafe characters."""
    name = Path(raw).name                           # discard any directory part
    name = re.sub(r"[^a-zA-Z0-9._\-]", "_", name)  # keep safe chars only
    return name or "upload"


def _resolve_mime(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    known = EXTENSION_MIME.get(ext)
    if known:
        return known
    guessed, _ = mimetypes.guess_type(filename)
    return guessed or "application/octet-stream"


def _is_allowed(filename: str) -> bool:
    ext = Path(filename).suffix.lower()
    return ext not in BLOCKED_EXTENSIONS


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------

async def save_uploaded_file(
    file: UploadFile,
    thread_id: int,
    db: Session,
) -> Attachment:
    """
    Validate, persist, and register one uploaded file.

    Security checks performed:
      - File size ≤ MAX_FILE_SIZE_MB
      - Extension in allowlist
      - Extension not in blocklist (executables, scripts)
    """
    content = await file.read()

    if len(content) > MAX_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds the {settings.MAX_FILE_SIZE_MB} MB upload limit.",
        )

    safe_name = _sanitize_filename(file.filename or "upload")

    if not _is_allowed(safe_name):
        raise HTTPException(
            status_code=415,
            detail=f"File type '{Path(safe_name).suffix}' is not supported.",
        )

    mime_type = _resolve_mime(safe_name)

    # Build target path: <UPLOAD_DIR>/<thread_id>/<uuid>_<safe_name>
    upload_dir = _uploads_root() / str(thread_id)
    upload_dir.mkdir(parents=True, exist_ok=True)

    unique_name = f"{uuid.uuid4().hex}_{safe_name}"
    file_path = upload_dir / unique_name

    async with aiofiles.open(file_path, "wb") as fh:
        await fh.write(content)

    file_url = f"/uploads/{thread_id}/{unique_name}"

    attachment = Attachment(
        thread_id=thread_id,
        message_id=None,       # linked after the message row is created
        file_name=safe_name,
        file_type=mime_type,
        file_url=file_url,
        file_size=len(content),
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return attachment


# ---------------------------------------------------------------------------
# Message linking
# ---------------------------------------------------------------------------

def link_attachments_to_message(
    attachment_ids: List[int],
    message_id: int,
    db: Session,
) -> None:
    """Set message_id on all listed attachments (called after message is saved)."""
    if not attachment_ids:
        return
    stmt = select(Attachment).where(Attachment.id.in_(attachment_ids))
    for att in db.execute(stmt).scalars().all():
        att.message_id = message_id
    db.commit()


# ---------------------------------------------------------------------------
# AI context extraction
# ---------------------------------------------------------------------------

def build_attachment_context(
    attachment_ids: List[int],
    db: Session,
) -> Tuple[str, List[dict]]:
    """
    Build (text_context, image_parts) for the AI prompt.

    text_context — plain text that is prepended to the user message.
    image_parts  — list of OpenAI-format image_url dicts for multimodal calls.
    """
    if not attachment_ids:
        return "", []

    stmt = select(Attachment).where(Attachment.id.in_(attachment_ids))
    attachments = db.execute(stmt).scalars().all()

    text_parts: List[str] = []
    image_parts: List[dict] = []

    for att in attachments:
        # Reconstruct the filesystem path from the URL
        # file_url looks like /uploads/<thread_id>/<filename>
        rel = Path(att.file_url.lstrip("/"))     # uploads/<thread_id>/<filename>
        # Store is rooted at <UPLOAD_DIR>; drop leading "uploads" segment if present.
        parts = rel.parts[1:] if rel.parts and rel.parts[0] == "uploads" else rel.parts
        file_path = _uploads_root().joinpath(*parts)

        mime = att.file_type

        if mime.startswith("image/"):
            _handle_image(att, file_path, text_parts, image_parts)

        elif mime == "text/csv":
            text_parts.append(_parse_csv(file_path, att.file_name))

        elif mime == "text/tab-separated-values":
            text_parts.append(_parse_tsv(file_path, att.file_name))

        elif mime in {
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel",
        }:
            text_parts.append(_parse_excel(file_path, att.file_name))

        elif mime.startswith("video/"):
            _handle_video(att, file_path, text_parts, image_parts)

        elif mime == "application/pdf":
            text_parts.append(_parse_pdf(file_path, att.file_name))

        else:
            # JSON, code, text, markdown, and unknown formats.
            text_parts.append(_read_file_with_fallback(file_path, att.file_name, mime, max_chars=8_000))

    return "\n\n".join(text_parts), image_parts


# ---------------------------------------------------------------------------
# Per-type helpers
# ---------------------------------------------------------------------------

def _handle_image(
    att: Attachment,
    path: Path,
    text_parts: List[str],
    image_parts: List[dict],
) -> None:
    try:
        raw = path.read_bytes()
        b64 = base64.b64encode(raw).decode()
        image_parts.append(
            {
                "type": "image_url",
                "image_url": {"url": f"data:{att.file_type};base64,{b64}"},
            }
        )
        text_parts.append(f"[Image attached: {att.file_name}]")
    except Exception as exc:
        text_parts.append(f"[Image: {att.file_name} — could not be read: {exc}]")


def _handle_video(
    att: Attachment,
    path: Path,
    text_parts: List[str],
    image_parts: List[dict],
) -> None:
    """Extract video metadata and a few frames for multimodal analysis."""
    size_mb = round((att.file_size or 0) / (1024 * 1024), 2)

    try:
        import cv2  # type: ignore
    except Exception:
        text_parts.append(
            f"[Video attached: {att.file_name} — MIME: {att.file_type}, Size: {size_mb} MB. "
            "Frame extraction is unavailable on the server, so analyze based on filename/metadata only.]"
        )
        return

    capture = cv2.VideoCapture(str(path))
    if not capture.isOpened():
        text_parts.append(
            f"[Video attached: {att.file_name} — MIME: {att.file_type}, Size: {size_mb} MB. "
            "The server could not open this video for frame extraction.]"
        )
        return

    try:
        fps = capture.get(cv2.CAP_PROP_FPS) or 0.0
        frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
        duration_seconds = (frame_count / fps) if fps and frame_count else 0.0

        text_parts.append(
            f"[Video attached: {att.file_name}]\n"
            f"- MIME: {att.file_type}\n"
            f"- Size: {size_mb} MB\n"
            f"- Resolution: {width}x{height}\n"
            f"- Duration: {duration_seconds:.1f} seconds\n"
            "Representative frames from this video are attached below for visual analysis."
        )

        if frame_count <= 0:
            return

        # Sample beginning, middle, and near-end frames.
        sample_positions = sorted({0, max(frame_count // 2, 0), max(frame_count - 1, 0)})

        for index, position in enumerate(sample_positions, start=1):
            capture.set(cv2.CAP_PROP_POS_FRAMES, position)
            ok, frame = capture.read()
            if not ok or frame is None:
                continue

            ok, encoded = cv2.imencode('.jpg', frame)
            if not ok:
                continue

            b64 = base64.b64encode(encoded.tobytes()).decode()
            image_parts.append(
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
                }
            )
            seconds = (position / fps) if fps else 0.0
            text_parts.append(f"[Video frame {index}: approximately {seconds:.1f}s]")
    except Exception as exc:
        text_parts.append(
            f"[Video attached: {att.file_name} — metadata extracted partially, but frame analysis failed: {exc}]"
        )
    finally:
        capture.release()


def _read_text(path: Path, name: str, max_chars: int = 8_000) -> str:
    try:
        raw = path.read_text(encoding="utf-8", errors="replace")
        if len(raw) > max_chars:
            raw = raw[:max_chars] + f"\n… [truncated to {max_chars} chars]"
        ext = path.suffix.lstrip(".")
        return f"[File: {name}]\n```{ext}\n{raw}\n```"
    except Exception as exc:
        return f"[File: {name} — read error: {exc}]"


def _read_file_with_fallback(path: Path, name: str, mime: str, max_chars: int = 8_000) -> str:
    """Read text-like files and gracefully summarize binary/unknown files."""
    try:
        raw = path.read_bytes()
        # Detect binary blobs: null byte in first chunk is a strong signal.
        if b"\x00" in raw[:4096]:
            size_mb = round(len(raw) / (1024 * 1024), 2)
            return f"[File attached: {name} — MIME: {mime}, Size: {size_mb} MB. Binary file; text extraction skipped.]"

        text = raw.decode("utf-8", errors="replace")
        if len(text) > max_chars:
            text = text[:max_chars] + f"\n… [truncated to {max_chars} chars]"
        ext = path.suffix.lstrip(".")
        return f"[File: {name}]\n```{ext}\n{text}\n```"
    except Exception as exc:
        return f"[File attached: {name} — MIME: {mime}. Could not parse file content: {exc}]"


def _parse_csv(path: Path, name: str) -> str:
    try:
        import pandas as pd
        df = pd.read_csv(path)
        rows, cols = df.shape
        preview = df.head(20).to_markdown(index=False)
        return (
            f"[CSV: {name}] — {rows} rows × {cols} columns\n"
            f"Columns: {', '.join(df.columns.tolist())}\n\n"
            f"Preview (first 20 rows):\n{preview}"
        )
    except ImportError:
        return _read_text(path, name, max_chars=4_000)
    except Exception as exc:
        return f"[CSV: {name} — parse error: {exc}]"


def _parse_tsv(path: Path, name: str) -> str:
    try:
        import pandas as pd
        df = pd.read_csv(path, sep="\t")
        rows, cols = df.shape
        preview = df.head(20).to_markdown(index=False)
        return (
            f"[TSV: {name}] — {rows} rows × {cols} columns\n"
            f"Columns: {', '.join(df.columns.tolist())}\n\n"
            f"Preview (first 20 rows):\n{preview}"
        )
    except ImportError:
        return _read_text(path, name, max_chars=4_000)
    except Exception as exc:
        return f"[TSV: {name} — parse error: {exc}]"


def _parse_excel(path: Path, name: str) -> str:
    try:
        import pandas as pd
        sheets = pd.read_excel(path, sheet_name=None)
        parts = [f"[Excel: {name}]"]
        for sheet, df in list(sheets.items())[:5]:   # cap at 5 sheets
            preview = df.head(10).to_markdown(index=False)
            parts.append(f"\nSheet '{sheet}' — {df.shape[0]} rows × {df.shape[1]} cols\n{preview}")
        return "\n".join(parts)
    except ImportError:
        return f"[Excel: {name} — pandas/openpyxl not installed]"
    except Exception as exc:
        return f"[Excel: {name} — parse error: {exc}]"


def _parse_pdf(path: Path, name: str) -> str:
    # Prefer pypdf, fallback to PyPDF2 for compatibility.
    reader_cls = None
    reader_source = None
    try:
        from pypdf import PdfReader as _PdfReader  # type: ignore
        reader_cls = _PdfReader
        reader_source = "pypdf"
    except Exception:
        try:
            import PyPDF2  # type: ignore
            reader_cls = PyPDF2.PdfReader
            reader_source = "PyPDF2"
        except Exception:
            return f"[PDF: {name} — no PDF parser installed (install pypdf)]"

    try:
        with open(path, "rb") as fh:
            reader = reader_cls(fh)
            collected: List[str] = []
            for i, page in enumerate(reader.pages[:10]):
                text = (page.extract_text() or "").strip()
                if text:
                    collected.append(f"--- Page {i + 1} ---\n{text}")

        if not collected:
            return (
                f"[PDF: {name}] Could not extract readable text (scanned/image-based PDF likely). "
                "Please ask for OCR if needed."
            )

        merged = "\n\n".join(collected)
        if len(merged) > 8_000:
            merged = merged[:8_000] + "\n… [PDF text truncated]"
        return f"[PDF: {name} via {reader_source}]\n{merged}"
    except Exception as exc:
        return f"[PDF: {name} — parse error: {exc}]"


# ---------------------------------------------------------------------------
# Multimodal message builder
# ---------------------------------------------------------------------------

def build_human_message(text: str, image_parts: List[dict]) -> HumanMessage:
    """Construct a HumanMessage; uses multimodal content when images are present."""
    if image_parts:
        return HumanMessage(content=[{"type": "text", "text": text}, *image_parts])
    return HumanMessage(content=text)
