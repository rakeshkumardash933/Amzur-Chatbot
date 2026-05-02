"""
Chat API routes.
"""
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.session import get_db_session
from app.core.auth import get_current_user
from app.models import User, Chat
from app.schemas.chat import ChatRequest, ChatTitleUpdateRequest
from app.services.chat_service import chat_service

router = APIRouter(prefix="/api", tags=["chat"])


def _display_title(chat: Chat) -> str:
    """Use chat number for legacy placeholder titles."""
    raw = (chat.title or "").strip()
    if not raw or raw.lower() == "new chat":
        return f"Chat #{chat.id}"
    return raw


async def _get_owned_chat(chat_id: int, user_id: int, db: Session) -> Chat:
    stmt = select(Chat).where(Chat.id == chat_id, Chat.user_id == user_id)
    chat = db.execute(stmt).scalars().first()
    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found",
        )
    return chat


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
        )

        return {
            "response": ai_response,
            "chat_id": chat_obj.id,
            "title": chat_obj.title,
        }
    except HTTPException:
        raise
    except Exception as exc:
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
            "messages": [
                {
                    "id": msg.id,
                    "sender": msg.sender,
                    "content": msg.content,
                    "timestamp": msg.timestamp.isoformat(),
                }
                for msg in chat.messages
            ],
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
