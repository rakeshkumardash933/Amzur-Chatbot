"""
SQLAlchemy model for uploaded PDF documents and their processing status.
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, BigInteger, Text, Boolean
from sqlalchemy.orm import relationship
from app.models.base import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    thread_id = Column(Integer, ForeignKey("chats.id"), nullable=True, index=True)

    # File metadata
    file_name = Column(String(500), nullable=False)
    file_size = Column(BigInteger, nullable=False, default=0)
    file_path = Column(String(1000), nullable=False)

    # Processing state
    is_processed = Column(Boolean, default=False, nullable=False)
    chunk_count = Column(Integer, default=0, nullable=False)
    # ChromaDB collection name for this document's embeddings
    collection_name = Column(String(255), nullable=True)
    # Any error that occurred during processing
    error_message = Column(Text, nullable=True)

    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    processed_at = Column(DateTime, nullable=True)

    user = relationship("User", foreign_keys=[user_id])
    chat = relationship("Chat", foreign_keys=[thread_id])
