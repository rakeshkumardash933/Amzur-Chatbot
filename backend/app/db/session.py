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
        if "google_id" not in user_columns:
            with engine.begin() as connection:
                connection.execute(
                    text("ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255)")
                )
        with engine.begin() as connection:
            connection.execute(
                text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_id ON users (google_id)")
            )
        if "password_hash" in user_columns:
            with engine.begin() as connection:
                connection.execute(
                    text("ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL")
                )

    if "generated_images" in table_names:
        gi_columns = {column["name"] for column in inspector.get_columns("generated_images")}
        if "image_data" not in gi_columns:
            with engine.begin() as connection:
                connection.execute(
                    text("ALTER TABLE generated_images ADD COLUMN IF NOT EXISTS image_data TEXT")
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

    # documents table — created by Base.metadata.create_all above, but ensure
    # safe column additions if the table existed from a previous deployment.
    if "documents" in table_names:
        doc_columns = {column["name"] for column in inspector.get_columns("documents")}
        for col_def in [
            ("collection_name", "VARCHAR(255)"),
            ("error_message", "TEXT"),
            ("processed_at", "TIMESTAMP"),
            ("chunk_count", "INTEGER DEFAULT 0"),
            ("is_processed", "BOOLEAN DEFAULT FALSE NOT NULL"),
        ]:
            col_name, col_type = col_def
            if col_name not in doc_columns:
                with engine.begin() as connection:
                    connection.execute(
                        text(f"ALTER TABLE documents ADD COLUMN IF NOT EXISTS {col_name} {col_type}")
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
