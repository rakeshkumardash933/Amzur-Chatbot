"""
Document (RAG) API routes.
Handles PDF upload, listing, deletion, and document-aware chat.
"""
import asyncio
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.auth import get_current_user
from app.db.session import get_db_session
from app.models import User, Chat
from app.models.document import Document
from app.services.pdf_service import pdf_service
from app.services.chat_service import chat_service

router = APIRouter(prefix="/api", tags=["documents"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_owned_chat(chat_id: int, user_id: int, db: Session) -> Chat:
    stmt = select(Chat).where(Chat.id == chat_id, Chat.user_id == user_id)
    chat = db.execute(stmt).scalars().first()
    if not chat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
    return chat


def _serialize_document(doc: Document) -> dict:
    return {
        "id": doc.id,
        "file_name": doc.file_name,
        "file_size": doc.file_size,
        "thread_id": doc.thread_id,
        "is_processed": doc.is_processed,
        "chunk_count": doc.chunk_count,
        "error_message": doc.error_message,
        "uploaded_at": doc.uploaded_at.isoformat(),
        "processed_at": doc.processed_at.isoformat() if doc.processed_at else None,
    }


# ---------------------------------------------------------------------------
# POST /api/upload-pdf
# ---------------------------------------------------------------------------

@router.post("/upload-pdf")
async def upload_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    thread_id: int = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> dict:
    """
    Upload a PDF, save it, and kick off background indexing.
    Returns immediately with the document record; poll GET /api/documents/{id}
    to check processing status.
    """
    # Verify the user owns the thread
    await _get_owned_chat(thread_id, current_user.id, db)

    # Read file bytes
    file_bytes = await file.read()
    file_size = len(file_bytes)

    # Validate
    ok, err = pdf_service.validate_pdf_file(file.filename or "upload.pdf", file_size)
    if not ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err)

    # Save to disk
    pdf_path = pdf_service.save_pdf_file(file_bytes, file.filename or "upload.pdf")

    # Create DB record
    doc = Document(
        user_id=current_user.id,
        thread_id=thread_id,
        file_name=file.filename or "upload.pdf",
        file_size=file_size,
        file_path=str(pdf_path),
        is_processed=False,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Process in background so the HTTP response returns immediately
    def _process():
        from app.db.session import SessionLocal
        bg_db = SessionLocal()
        try:
            bg_doc = bg_db.get(Document, doc.id)
            if bg_doc:
                pdf_service.process_document(bg_doc, bg_db)
        finally:
            bg_db.close()

    background_tasks.add_task(_process)

    return {
        "success": True,
        "document": _serialize_document(doc),
        "message": "PDF uploaded. Indexing in progress — ask questions once processing is complete.",
    }


# ---------------------------------------------------------------------------
# GET /api/documents?thread_id=<id>
# ---------------------------------------------------------------------------

@router.get("/documents")
async def list_documents(
    thread_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> dict:
    """List all documents for a thread owned by the current user."""
    await _get_owned_chat(thread_id, current_user.id, db)

    stmt = (
        select(Document)
        .where(Document.thread_id == thread_id, Document.user_id == current_user.id)
        .order_by(Document.uploaded_at.asc())
    )
    docs = list(db.execute(stmt).scalars().all())

    return {
        "success": True,
        "documents": [_serialize_document(d) for d in docs],
    }


# ---------------------------------------------------------------------------
# GET /api/documents/{document_id}  — status polling
# ---------------------------------------------------------------------------

@router.get("/documents/{document_id}")
async def get_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> dict:
    """Get a single document's current processing status."""
    doc = db.get(Document, document_id)
    if not doc or doc.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    return {"success": True, "document": _serialize_document(doc)}


# ---------------------------------------------------------------------------
# DELETE /api/documents/{document_id}
# ---------------------------------------------------------------------------

@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> dict:
    """Delete a document, its file on disk, and its ChromaDB embeddings."""
    doc = db.get(Document, document_id)
    if not doc or doc.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Remove ChromaDB collection
    if doc.collection_name:
        pdf_service.delete_collection(doc.collection_name)

    # Remove file from disk
    try:
        Path(doc.file_path).unlink(missing_ok=True)
    except Exception:
        pass

    db.delete(doc)
    db.commit()

    return {"success": True, "message": "Document deleted."}


# ---------------------------------------------------------------------------
# POST /api/chat-with-document
# ---------------------------------------------------------------------------

@router.post("/chat-with-document")
async def chat_with_document(
    request: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> dict:
    """
    RAG-powered chat: retrieves relevant chunks from indexed PDFs
    and injects them as context before calling the LLM.

    Body: { "message": str, "thread_id": int }
    """
    message: str = (request.get("message") or "").strip()
    thread_id: int = request.get("thread_id")

    if not message:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="message is required")
    if not thread_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="thread_id is required")

    await _get_owned_chat(thread_id, current_user.id, db)

    # Fetch all processed documents for this thread
    stmt = (
        select(Document)
        .where(
            Document.thread_id == thread_id,
            Document.user_id == current_user.id,
            Document.is_processed == True,  # noqa: E712
        )
    )
    docs = list(db.execute(stmt).scalars().all())

    if not docs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No processed documents found for this thread. Upload and wait for indexing to complete.",
        )

    collection_names = [d.collection_name for d in docs if d.collection_name]

    # Retrieve top relevant chunks
    chunks = pdf_service.retrieve_chunks(message, collection_names, n_results=5)

    if chunks:
        doc_context = "\n\n".join(
            f"[{c['file_name']} | chunk {c['chunk_index']}]\n{c['text']}" for c in chunks
        )
        augmented_message = (
            "You are a helpful assistant. Answer the user's question using ONLY the document context below.\n"
            "If the answer is not in the context, say you could not find it in the document.\n\n"
            f"Document context:\n{doc_context}\n\n"
            f"User question: {message}"
        )
        sources = [
            {"file_name": c["file_name"], "chunk_index": c["chunk_index"]}
            for c in chunks
        ]
    else:
        augmented_message = message
        sources = []

    # Delegate to the normal chat service (saves to DB, respects thread memory)
    ai_response = await chat_service.chat(
        augmented_message,
        thread_id,
        db,
        current_user,
    )

    return {
        "success": True,
        "response": ai_response,
        "sources": sources,
        "thread_id": thread_id,
    }
