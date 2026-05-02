"""
Database session factory and utilities.
"""
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings
from app.models import Base

engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    future=True,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    class_=Session,
)


def init_db() -> None:
    """Initialize database tables."""
    Base.metadata.create_all(bind=engine)

    inspector = inspect(engine)
    table_names = inspector.get_table_names()

    if "users" in table_names:
        user_columns = {column["name"] for column in inspector.get_columns("users")}
        if "name" not in user_columns:
            with engine.begin() as connection:
                connection.execute(
                    text("ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255) NOT NULL DEFAULT 'User'")
                )
        if "password_hash" in user_columns:
            with engine.begin() as connection:
                connection.execute(
                    text("ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL")
                )

    if "chats" in table_names:
        chat_columns = {column["name"] for column in inspector.get_columns("chats")}
        if "title" not in chat_columns:
            with engine.begin() as connection:
                connection.execute(
                    text("ALTER TABLE chats ADD COLUMN IF NOT EXISTS title VARCHAR(255) NOT NULL DEFAULT 'New Chat'")
                )

        with engine.begin() as connection:
            connection.execute(
                text(
                    """
                    UPDATE chats
                    SET title = 'Chat #' || id
                    WHERE title IS NULL
                       OR btrim(title) = ''
                       OR lower(btrim(title)) = 'new chat'
                    """
                )
            )


def get_db_session() -> Session:
    """
    Dependency for FastAPI route handlers.
    Yields a database session for the request lifecycle.
    """
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
