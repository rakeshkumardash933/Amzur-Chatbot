"""MCP tool wrapper for image generation."""
from __future__ import annotations

from typing import Any

from sqlalchemy import select

from app.db.session import SessionLocal
from app.mcp.tool_registry import MCPTool, MCPToolRegistry
from app.models import User
from app.services.image_generation_service import image_generation_service


async def _generate_image(args: dict[str, Any]) -> dict[str, Any]:
    prompt = str(args.get("prompt", "")).strip()
    thread_id = int(args.get("thread_id"))
    user_id = int(args.get("user_id"))

    if not prompt:
        raise ValueError("prompt is required")

    with SessionLocal() as db:
        user = db.execute(select(User).where(User.id == user_id)).scalars().first()
        if not user:
            raise ValueError("user not found")
        result = await image_generation_service.generate_image(prompt=prompt, thread_id=thread_id, user=user, db=db)
    return result


def register_image_tools(registry: MCPToolRegistry) -> None:
    registry.register(
        MCPTool(
            name="image.generate",
            description="Generate an image from a prompt using configured image model.",
            input_schema={"type": "object", "required": ["prompt", "thread_id", "user_id"], "properties": {"prompt": {"type": "string"}, "thread_id": {"type": "integer"}, "user_id": {"type": "integer"}}},
            output_schema={"type": "object"},
            handler=_generate_image,
        )
    )
