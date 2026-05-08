"""
Chat API routes — includes file upload and thread/message management.
"""
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, Depends, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.session import get_db_session
from app.core.auth import get_current_user
from app.models import User, Chat
from app.schemas.chat import ChatRequest, ChatTitleUpdateRequest
from app.services.chat_service import chat_service
from app.services.attachment_service import save_uploaded_file

router = APIRouter(prefix="/api", tags=["chat"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _display_title(chat: Chat) -> str:
    raw = (chat.title or "").strip()
    if not raw or raw.lower() == "new chat":
        return f"Chat #{chat.id}"
    return raw


def _serialize_attachment(att) -> dict:
    return {
        "id": att.id,
        "file_name": att.file_name,
        "file_type": att.file_type,
        "file_url": att.file_url,
        "file_size": att.file_size,
    }


def _serialize_message(msg) -> dict:
    return {
        "id": msg.id,
        "sender": msg.sender,
        "content": msg.content,
        "timestamp": msg.timestamp.isoformat(),
        "attachments": [_serialize_attachment(a) for a in (msg.attachments or [])],
    }


async def _get_owned_chat(chat_id: int, user_id: int, db: Session) -> Chat:
    stmt = select(Chat).where(Chat.id == chat_id, Chat.user_id == user_id)
    chat = db.execute(stmt).scalars().first()
    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found",
        )
    return chat


# ---------------------------------------------------------------------------
# File upload
# ---------------------------------------------------------------------------

@router.post("/upload")
async def upload_attachment(
    file: UploadFile = File(...),
    thread_id: int = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> dict:
    """
    Upload a file attachment and associate it with a chat thread.

    Returns attachment metadata including the server-assigned ID that must be
    passed as attachment_ids in the subsequent POST /api/chat request.
    """
    # Verify the user owns this thread before accepting any bytes.
    await _get_owned_chat(thread_id, current_user.id, db)
    attachment = await save_uploaded_file(file, thread_id, db)
    return {
        "id": attachment.id,
        "file_name": attachment.file_name,
        "file_type": attachment.file_type,
        "file_url": attachment.file_url,
        "file_size": attachment.file_size,
    }


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------

@router.post("/chat")
async def chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> dict:
    """Send message and receive AI reply. Creates chat when chat_id is null."""
    try:
        chat_id = request.chat_id
        if chat_id is None:
            title = await chat_service.generate_chat_title(request.message, current_user)
            new_chat = Chat(user_id=current_user.id, title=title)
            db.add(new_chat)
            db.commit()
            db.refresh(new_chat)
            chat_obj = new_chat
        else:
            chat_obj = await _get_owned_chat(chat_id, current_user.id, db)

        ai_response = await chat_service.chat(
            request.message,
            chat_obj.id,
            db,
            current_user,
            attachment_ids=request.attachment_ids,
        )

        return {
            "response": ai_response,
            "chat_id": chat_obj.id,
            "title": chat_obj.title,
        }
    except HTTPException:
        raise
    except Exception as exc:
        if "__BUDGET_EXCEEDED__" in str(exc):
            raise HTTPException(
                status_code=402,
                detail="The organisation's AI budget has been exhausted. Please contact your admin to top up the LiteLLM quota.",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process message: {str(exc)}",
        )


@router.post("/chat/stream")
async def chat_stream(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> StreamingResponse:
    """Stream AI response with Server-Sent Events."""
    if request.chat_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="chat_id is required for streaming",
        )

    await _get_owned_chat(request.chat_id, current_user.id, db)

    async def event_generator():
        try:
            async for token in chat_service.chat_stream(
                request.message,
                request.chat_id,
                db,
                current_user,
                attachment_ids=request.attachment_ids,
            ):
                yield f"data: {token}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as exc:
            yield f"data: [ERROR] {str(exc)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# Thread management
# ---------------------------------------------------------------------------

@router.get("/chats")
async def get_user_chats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> dict:
    """Return chat threads for the authenticated user."""
    try:
        stmt = select(Chat).where(Chat.user_id == current_user.id).order_by(Chat.updated_at.desc())
        chats = db.execute(stmt).scalars().all()
        return {
            "chats": [
                {
                    "chat_id": chat.id,
                    "title": _display_title(chat),
                    "created_at": chat.created_at.isoformat(),
                    "updated_at": chat.updated_at.isoformat() if chat.updated_at else None,
                    "message_count": len(chat.messages),
                }
                for chat in chats
            ]
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve chats: {str(exc)}",
        )


@router.get("/chats/{chat_id}")
async def get_chat_messages(
    chat_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> dict:
    """Return all messages for a specific chat."""
    try:
        chat = await _get_owned_chat(chat_id, current_user.id, db)
        return {
            "chat_id": chat.id,
            "title": _display_title(chat),
            "messages": [_serialize_message(m) for m in chat.messages],
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve messages: {str(exc)}",
        )


@router.put("/chats/{chat_id}")
async def update_chat_title(
    chat_id: int,
    request: ChatTitleUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> dict:
    """Update chat title."""
    title = request.title.strip()
    if not title:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Title cannot be empty",
        )

    try:
        chat = await _get_owned_chat(chat_id, current_user.id, db)
        chat.title = title
        db.add(chat)
        db.commit()
        db.refresh(chat)
        return {
            "chat_id": chat.id,
            "title": chat.title,
        }
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update chat: {str(exc)}",
        )


@router.delete("/chats/{chat_id}")
async def delete_chat(
    chat_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> dict:
    """Delete a chat and related messages."""
    try:
        chat = await _get_owned_chat(chat_id, current_user.id, db)
        db.delete(chat)
        db.commit()
        chat_service.clear_conversation(chat_id)
        return {"message": f"Chat {chat_id} deleted successfully"}
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete chat: {str(exc)}",
        )


@router.post("/chats/new")
async def create_new_chat(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> dict:
    """Create an empty chat thread."""
    try:
        new_chat = Chat(user_id=current_user.id, title="New Chat")
        db.add(new_chat)
        db.commit()
        db.refresh(new_chat)
        return {
            "chat_id": new_chat.id,
            "title": _display_title(new_chat),
            "created_at": new_chat.created_at.isoformat(),
        }
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create chat: {str(exc)}",
        )
