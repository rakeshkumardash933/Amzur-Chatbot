"""
Attachment model — stores metadata for files uploaded inside chat threads.
The physical file is stored on the local filesystem under /uploads/<thread_id>/.
"""
from datetime import datetime

from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.models.base import Base


class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, index=True)
    # Deleting a chat cascades to delete all its attachments via the DB FK.
    thread_id = Column(
        Integer,
        ForeignKey("chats.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Nullable until the user's message is saved; SET NULL keeps the row so
    # the file is not orphaned when individual messages are removed.
    message_id = Column(
        Integer,
        ForeignKey("messages.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    file_name = Column(String(255), nullable=False)
    file_type = Column(String(100), nullable=False)   # MIME type
    file_url = Column(String(512), nullable=False)    # served path, e.g. /uploads/3/abc.png
    file_size = Column(BigInteger, nullable=True)     # bytes
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    message = relationship("Message", back_populates="attachments")

    def __repr__(self) -> str:
        return f"<Attachment(id={self.id}, file_name={self.file_name!r})>"
