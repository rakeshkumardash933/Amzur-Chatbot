"""
Thread-scoped conversational memory utilities.

Memory is reconstructed from persisted PostgreSQL messages so context survives
restarts and user re-authentication.

Uses only langchain-core (always installed) — no dependency on the optional
top-level 'langchain' package, which may not be present in the venv.
"""
from __future__ import annotations

from typing import List, Tuple

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Message
from app.services.attachment_service import build_attachment_context


ConversationPair = Tuple[Message, Message]


def _build_user_memory_content(db: Session, user_msg: Message) -> str:
    """Augment a stored user message with linked attachment context for memory."""
    attachment_ids = [attachment.id for attachment in (user_msg.attachments or []) if attachment.id is not None]
    if not attachment_ids:
        return user_msg.content

    attachment_context, _ = build_attachment_context(attachment_ids, db)
    if not attachment_context:
        return user_msg.content

    return (
        f"{user_msg.content}\n\n"
        "[Attached file context from this earlier turn]\n"
        f"{attachment_context}"
    )


def get_last_conversations(db: Session, thread_id: int, limit: int = 5) -> List[ConversationPair]:
    """
    Return the last N complete (user, assistant) conversation pairs for a thread.

    A conversation is considered complete only when a user message is followed
    immediately by an assistant response.  The function reads a bounded tail of
    the thread's message history so it stays efficient on long threads.
    """
    # Fetch a small tail window — at most (limit*2)+10 rows — for scalability.
    max_messages = (limit * 2) + 10
    stmt = (
        select(Message)
        .where(Message.chat_id == thread_id)
        .order_by(Message.timestamp.desc(), Message.id.desc())
        .limit(max_messages)
    )
    recent_desc = db.execute(stmt).scalars().all()
    recent_messages = list(reversed(recent_desc))  # chronological order

    conversations: List[ConversationPair] = []
    pending_user: Message | None = None

    for msg in recent_messages:
        if msg.sender == "user":
            pending_user = msg
        elif msg.sender == "assistant" and pending_user is not None:
            conversations.append((pending_user, msg))
            pending_user = None

    # Keep only the most-recent N pairs.
    return conversations[-limit:]


def get_thread_memory_messages(db: Session, thread_id: int, limit: int = 5) -> List[BaseMessage]:
    """
    Build a LangChain message list representing the thread's last N conversations.

    The rolling window is enforced by slicing to `limit` conversation pairs.
    Messages are returned in chronological order:
        [HumanMessage, AIMessage, HumanMessage, AIMessage, ...]
    The caller appends the new HumanMessage before invoking the model.
    """
    messages: List[BaseMessage] = []
    for user_msg, assistant_msg in get_last_conversations(db, thread_id, limit=limit):
        messages.append(HumanMessage(content=_build_user_memory_content(db, user_msg)))
        messages.append(AIMessage(content=assistant_msg.content))
    return messages
