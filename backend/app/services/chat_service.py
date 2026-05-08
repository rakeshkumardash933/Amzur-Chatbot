"""Chat service for handling thread-scoped conversations through LiteLLM."""
import json
from typing import AsyncGenerator, List, Optional

from langchain_core.messages import AIMessageChunk
from openai import AsyncOpenAI
from sqlalchemy.orm import Session

from app.ai.llm import llm
from app.ai.memory import get_thread_memory_messages
from app.services.attachment_service import (
    build_attachment_context,
    build_human_message,
    link_attachments_to_message,
)
from app.core.config import settings
from app.models import Message, User


def _is_placeholder_key(value: str | None) -> bool:
    if not value:
        return True
    return value.startswith("your-")


class ChatService:
    """
    Service for managing chat conversations with LiteLLM proxy.
    Conversation memory is reconstructed from thread history stored in database.
    """

    def __init__(self):
        """Initialize the chat service with a LiteLLM-backed OpenAI client."""
        self.api_key = self._resolve_litellm_key()
        self.client = None
        if not _is_placeholder_key(self.api_key):
            self.client = AsyncOpenAI(
                api_key=self.api_key,
                base_url=settings.LITELLM_PROXY_URL,
            )

    def _resolve_litellm_key(self) -> str | None:
        """Prefer LITELLM_VIRTUAL_KEY and fallback to LITELLM_API_KEY."""
        return settings.LITELLM_VIRTUAL_KEY or settings.LITELLM_API_KEY

    def _build_user_metadata(self, user_email: str = "") -> dict:
        """Build metadata for LiteLLM calls."""
        return {
            "department": settings.LITELLM_DEPARTMENT or "Development",
            "environment": settings.LITELLM_ENVIRONMENT or "development",
            "application": "amzur-chatbot",
            "user_email": user_email,
        }

    def _build_spend_logs_metadata(self, user_id: int = 0) -> str:
        metadata = {
            "end_user": f"user_{user_id}" if user_id else "web-user",
            "department": settings.LITELLM_DEPARTMENT or "Development",
            "environment": settings.LITELLM_ENVIRONMENT or "development",
        }
        return json.dumps(metadata)

    def _local_fallback_response(self, user_message: str) -> str:
        """Provide a minimal local response when LiteLLM key is not configured."""
        cleaned = user_message.strip()
        return (
            "LiteLLM key is not configured yet. "
            "Set LITELLM_VIRTUAL_KEY (or LITELLM_API_KEY) in backend/.env to enable AI responses.\n\n"
            f"You said: {cleaned}"
        )

    async def generate_chat_title(self, first_message: str, user: User) -> str:
        """Generate a concise chat title from first message, using AI when available."""
        cleaned = " ".join(first_message.strip().split())
        if not cleaned:
            return "New Chat"

        if _is_placeholder_key(self.api_key) or self.client is None:
            words = cleaned.split()
            return " ".join(words[:6])[:60] or "New Chat"

        try:
            response = await self.client.chat.completions.create(
                model=settings.LLM_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": "Generate a short chat title (max 6 words). Return only the title.",
                    },
                    {"role": "user", "content": cleaned},
                ],
                temperature=0.2,
                user=user.email,
                extra_body={"metadata": self._build_user_metadata(user.email)},
                extra_headers={
                    "x-litellm-spend-logs-metadata": self._build_spend_logs_metadata(user.id)
                },
            )
            raw_title = (response.choices[0].message.content or "").strip()
            if not raw_title:
                raise ValueError("empty title")
            return raw_title[:80]
        except Exception:
            words = cleaned.split()
            return " ".join(words[:6])[:60] or "New Chat"

    def save_message(self, chat_id: int, role: str, content: str, db: Session) -> None:
        """Persist one message in PostgreSQL and return the saved object."""
        message = Message(chat_id=chat_id, sender=role, content=content)
        db.add(message)
        db.commit()
        db.refresh(message)
        return message

    @staticmethod
    def _normalize_chunk_content(content: str | List[dict] | None) -> str:
        """Normalize model content payloads to plain text."""
        if content is None:
            return ""
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            return "".join(str(item.get("text", "")) for item in content if isinstance(item, dict))
        return str(content)

    async def chat(
        self, user_message: str, chat_id: int, db: Session, user: User,
        attachment_ids: Optional[List[int]] = None,
    ) -> str:
        """Process a user message (with optional file attachments) and return the AI response."""
        # Build DB-backed thread memory before saving current user prompt.
        memory_messages = get_thread_memory_messages(db, chat_id, limit=5)

        # Extract text context and image data from any uploaded attachments.
        attachment_context, image_parts = build_attachment_context(
            attachment_ids or [], db
        )

        if _is_placeholder_key(self.api_key) or self.client is None:
            user_msg_obj = self.save_message(chat_id, "user", user_message, db)
            link_attachments_to_message(attachment_ids or [], user_msg_obj.id, db)
            ai_response = self._local_fallback_response(user_message)
            self.save_message(chat_id, "assistant", ai_response, db)
            return ai_response

        try:
            user_msg_obj = self.save_message(chat_id, "user", user_message, db)
            link_attachments_to_message(attachment_ids or [], user_msg_obj.id, db)

            # Build full prompt text, prepending attachment context when present.
            full_text = (
                "The user has shared files. Use their extracted content/metadata to answer. "
                "If the files contain tables, summarize key rows/columns and notable values. "
                "If they contain formulas, explain the notation, variables, and meaning step by step. "
                "If they contain code, explain what the code does, important functions, bugs, and improvements when relevant. "
                "When file text is unavailable, explicitly say what was unavailable and why.\n\n"
                f"Files context:\n\n{attachment_context}\n\n"
                f"---\nUser message: {user_message}"
                if attachment_context
                else user_message
            )
            current_message = build_human_message(full_text, image_parts)
            prompt_messages = [*memory_messages, current_message]

            response = await llm.ainvoke(prompt_messages)
            ai_response = self._normalize_chunk_content(response.content)

            self.save_message(chat_id, "assistant", ai_response, db)

            return ai_response

        except Exception as e:
            err_str = str(e)
            if "budget_exceeded" in err_str or "Budget has been exceeded" in err_str:
                raise Exception("__BUDGET_EXCEEDED__")
            raise Exception(f"Error communicating with LiteLLM API: {err_str}")

    async def chat_stream(
        self, user_message: str, chat_id: int, db: Session, user: User,
        attachment_ids: Optional[List[int]] = None,
    ) -> AsyncGenerator[str, None]:
        """Stream an AI response token-by-token for real-time UI updates."""
        # Build DB-backed thread memory before saving current user prompt.
        memory_messages = get_thread_memory_messages(db, chat_id, limit=5)

        attachment_context, image_parts = build_attachment_context(
            attachment_ids or [], db
        )

        if _is_placeholder_key(self.api_key) or self.client is None:
            user_msg_obj = self.save_message(chat_id, "user", user_message, db)
            link_attachments_to_message(attachment_ids or [], user_msg_obj.id, db)
            fallback = self._local_fallback_response(user_message)
            self.save_message(chat_id, "assistant", fallback, db)
            yield fallback
            return

        user_msg_obj = self.save_message(chat_id, "user", user_message, db)
        link_attachments_to_message(attachment_ids or [], user_msg_obj.id, db)

        full_text = (
            "The user has shared files. Use their extracted content/metadata to answer. "
            "If the files contain tables, summarize key rows/columns and notable values. "
            "If they contain formulas, explain the notation, variables, and meaning step by step. "
            "If they contain code, explain what the code does, important functions, bugs, and improvements when relevant. "
            "When file text is unavailable, explicitly say what was unavailable and why.\n\n"
            f"Files context:\n\n{attachment_context}\n\n"
            f"---\nUser message: {user_message}"
            if attachment_context
            else user_message
        )
        current_message = build_human_message(full_text, image_parts)
        prompt_messages = [*memory_messages, current_message]
        assembled = ""

        try:
            async for chunk in llm.astream(prompt_messages):
                if not isinstance(chunk, AIMessageChunk):
                    continue
                delta = self._normalize_chunk_content(chunk.content)
                if delta:
                    assembled += delta
                    yield delta

            self.save_message(chat_id, "assistant", assembled, db)
        except Exception as e:
            raise Exception(f"Error streaming from LiteLLM API: {str(e)}")

    def clear_conversation(self, chat_id: int | str) -> None:
        """No-op for compatibility. Memory is database-backed by thread."""
        return None


# Global instance
chat_service = ChatService()
