"""
Pydantic schemas for chat requests and responses.
"""
from typing import Optional
from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    """Request schema for chat endpoint."""

    message: str = Field(..., min_length=1, max_length=5000, description="User message")
    chat_id: Optional[int] = Field(default=None, description="Chat/Thread ID")


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
