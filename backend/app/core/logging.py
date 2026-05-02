"""
Logging configuration.
"""
import logging
from app.core.config import settings


def setup_logging():
    """Configure logging for the application."""
    logging.basicConfig(
        level=settings.LOG_LEVEL,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )
