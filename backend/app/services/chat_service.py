"""
Chat service for handling conversations through the LiteLLM proxy.
"""
import json
from typing import AsyncGenerator, Dict, List
from datetime import datetime
from openai import AsyncOpenAI
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.core.config import settings
from app.models import Chat, Message, User


def _is_placeholder_key(value: str | None) -> bool:
    if not value:
        return True
    return value.startswith("your-")


class ChatService:
    """
    Service for managing chat conversations with LiteLLM proxy.
    Maintains conversation history in memory and persists to database.
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
        # In-memory conversation storage: {chat_id: [messages as OpenAI dicts]}
        self.conversations: Dict[str, List[Dict[str, str]]] = {}

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

    def get_conversation_history(self, chat_id: int | str) -> List[Dict[str, str]]:
        """Get conversation history from memory cache."""
        return self.conversations.get(str(chat_id), [])

    def load_chat_from_db(self, db: Session, chat_id: int) -> List[Dict[str, str]]:
        """Load chat history from database."""
        stmt = select(Message).where(Message.chat_id == chat_id)
        messages = db.execute(stmt).scalars().all()
        
        history = []
        for msg in messages:
            history.append({
                "role": msg.sender,
                "content": msg.content
            })
        
        # Cache in memory
        self.conversations[str(chat_id)] = history
        return history

    def add_message_to_history(
        self, chat_id: int | str, role: str, content: str, db: Session | None = None
    ) -> None:
        """Add a message to conversation history and optionally persist to database."""
        chat_key = str(chat_id)
        if chat_key not in self.conversations:
            self.conversations[chat_key] = []
        self.conversations[chat_key].append({"role": role, "content": content})
        
        # Save to database if session provided
        if db and isinstance(chat_id, int):
            message = Message(
                chat_id=chat_id,
                sender=role,
                content=content
            )
            db.add(message)
            db.commit()

    async def chat(
        self, user_message: str, chat_id: int, db: Session, user: User
    ) -> str:
        """
        Process a user message and return the AI response.
        
        Args:
            user_message: The user's input message
            chat_id: Chat ID for database persistence
            db: Database session
            user: Authenticated user object
            
        Returns:
            The AI-generated response
        """
        # Load chat history
        history = self.load_chat_from_db(db, chat_id)
        
        if _is_placeholder_key(self.api_key) or self.client is None:
            self.add_message_to_history(chat_id, "user", user_message, db)
            ai_response = self._local_fallback_response(user_message)
            self.add_message_to_history(chat_id, "assistant", ai_response, db)
            return ai_response

        try:
            # Add user message to history
            self.add_message_to_history(chat_id, "user", user_message, db)
            history = self.get_conversation_history(chat_id)

            response = await self.client.chat.completions.create(
                model=settings.LLM_MODEL,
                messages=history,
                temperature=0.7,
                user=user.email,
                extra_body={"metadata": self._build_user_metadata(user.email)},
                extra_headers={
                    "x-litellm-spend-logs-metadata": self._build_spend_logs_metadata(user.id)
                },
            )

            ai_response = response.choices[0].message.content or ""
            self.add_message_to_history(chat_id, "assistant", ai_response, db)

            return ai_response

        except Exception as e:
            raise Exception(f"Error communicating with LiteLLM API: {str(e)}")

    async def chat_stream(
        self, user_message: str, chat_id: int, db: Session, user: User
    ) -> AsyncGenerator[str, None]:
        """Stream an AI response token-by-token for real-time UI updates."""
        # Load chat history
        history = self.load_chat_from_db(db, chat_id)
        
        if _is_placeholder_key(self.api_key) or self.client is None:
            self.add_message_to_history(chat_id, "user", user_message, db)
            fallback = self._local_fallback_response(user_message)
            self.add_message_to_history(chat_id, "assistant", fallback, db)
            yield fallback
            return

        self.add_message_to_history(chat_id, "user", user_message, db)
        history = self.get_conversation_history(chat_id)
        assembled = ""

        try:
            stream = await self.client.chat.completions.create(
                model=settings.LLM_MODEL,
                messages=history,
                temperature=0.7,
                stream=True,
                user=user.email,
                extra_body={"metadata": self._build_user_metadata(user.email)},
                extra_headers={
                    "x-litellm-spend-logs-metadata": self._build_spend_logs_metadata(user.id)
                },
            )

            async for chunk in stream:
                delta = chunk.choices[0].delta.content if chunk.choices else None
                if delta:
                    assembled += delta
                    yield delta

            self.add_message_to_history(chat_id, "assistant", assembled, db)
        except Exception as e:
            raise Exception(f"Error streaming from LiteLLM API: {str(e)}")

    def clear_conversation(self, chat_id: int | str) -> None:
        """Clear the conversation history from memory cache."""
        chat_key = str(chat_id)
        if chat_key in self.conversations:
            del self.conversations[chat_key]


# Global instance
chat_service = ChatService()
