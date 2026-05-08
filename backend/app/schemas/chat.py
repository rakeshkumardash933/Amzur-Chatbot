"""
Pydantic schemas for chat requests and responses, including file attachments.
"""
from typing import List, Optional
from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    """Request schema for chat endpoint."""

    message: str = Field(..., min_length=1, max_length=5000, description="User message")
    chat_id: Optional[int] = Field(default=None, description="Chat/Thread ID")
    attachment_ids: List[int] = Field(
        default_factory=list,
        description="IDs of pre-uploaded attachments to include with this message",
    )


class ImageGenerationRequest(BaseModel):
    """Request schema for image generation endpoint."""

    prompt: str = Field(..., min_length=5, max_length=1000, description="Image generation prompt")
    thread_id: int = Field(..., description="Chat/Thread ID to associate the image with")


class ChatTitleUpdateRequest(BaseModel):
    """Request schema for updating chat title."""

    title: str = Field(..., min_length=1, max_length=255, description="Chat thread title")


class MessageResponse(BaseModel):
    """Response schema for a single message."""

    id: int = Field(..., description="Message ID")
    sender: str = Field(..., description="Message sender: 'user' or 'assistant'")
    content: str = Field(..., description="Message content")
    timestamp: str = Field(..., description="Message timestamp")


class ChatResponse(BaseModel):
    """Response schema for chat endpoint."""

    response: str = Field(..., description="AI-generated response")
    chat_id: int = Field(..., description="Chat ID")
    title: str = Field(..., description="Chat title")


class ErrorResponse(BaseModel):
    """Error response schema."""

    error: str = Field(..., description="Error message")
    detail: str = Field(..., description="Detailed error information")
