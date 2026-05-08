"""Pydantic schemas for file attachment endpoints."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class AttachmentOut(BaseModel):
    """Serialised attachment returned to the frontend."""

    id: int
    file_name: str
    file_type: str
    file_url: str
    file_size: Optional[int] = None
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class AttachmentUploadResponse(BaseModel):
    """Response returned immediately after a successful upload."""

    id: int = Field(..., description="Server-assigned attachment ID")
    file_name: str
    file_type: str
    file_url: str
    file_size: Optional[int] = None
