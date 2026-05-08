"""
GeneratedImage model for storing AI-generated images.
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, LargeBinary
from sqlalchemy.orm import relationship

from app.models.base import Base


class GeneratedImage(Base):
    """GeneratedImage model representing an AI-generated image in a chat."""

    __tablename__ = "generated_images"

    id = Column(Integer, primary_key=True, index=True)
    thread_id = Column(Integer, ForeignKey("chats.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    prompt = Column(Text, nullable=False)
    image_url = Column(String(500), nullable=False)
    image_data = Column(Text, nullable=True)  # base64-encoded image content for future editing
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    chat = relationship("Chat", foreign_keys=[thread_id])
    user = relationship("User", foreign_keys=[user_id])

    def __repr__(self) -> str:
        return f"<GeneratedImage(id={self.id}, thread_id={self.thread_id}, user_id={self.user_id})>"
