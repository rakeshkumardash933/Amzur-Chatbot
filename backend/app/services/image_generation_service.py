"""
Image generation service using LiteLLM proxy (routes to Gemini 2.5 Flash).
Auth: LITELLM_API_KEY — no personal Gemini quota involved.
"""
import asyncio
import base64
import time
import uuid
from pathlib import Path
from typing import Optional

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import GeneratedImage, User


class ImageGenerationService:
    IMAGE_GENERATION_KEYWORDS = [
        "generate image", "create image", "design", "make illustration", "draw",
        "create poster", "design logo", "design ui", "create mockup", "generate art",
        "make artwork", "create art", "generate design", "make logo", "create logo",
        "design mockup", "make diagram", "create diagram", "generate diagram",
        "illustration of", "image of", "picture of", "artwork",
    ]

    MAX_PROMPT_LENGTH = 1000
    MIN_PROMPT_LENGTH = 5
    UPLOAD_DIR = Path(__file__).parent.parent.parent / "uploads" / "generated_images"
    RATE_LIMIT_REQUESTS = 10
    RATE_LIMIT_WINDOW_SECONDS = 60

    def __init__(self):
        self.proxy_url = settings.LITELLM_PROXY_URL.rstrip("/")
        self.api_key = settings.LITELLM_API_KEY
        self.model = settings.IMAGE_GEN_MODEL
        self._request_log: dict[int, list[float]] = {}

    def _check_rate_limit(self, user_id: int) -> None:
        now = time.time()
        window_start = now - self.RATE_LIMIT_WINDOW_SECONDS
        timestamps = self._request_log.get(user_id, [])
        timestamps = [ts for ts in timestamps if ts >= window_start]
        if len(timestamps) >= self.RATE_LIMIT_REQUESTS:
            raise ValueError("Rate limit exceeded. Please wait before generating more images.")
        timestamps.append(now)
        self._request_log[user_id] = timestamps

    @staticmethod
    def is_image_generation_request(message: str) -> bool:
        lower_msg = message.lower()
        return any(keyword in lower_msg for keyword in ImageGenerationService.IMAGE_GENERATION_KEYWORDS)

    def validate_prompt(self, prompt: str) -> tuple[bool, Optional[str]]:
        if not prompt or not prompt.strip():
            return False, "Prompt cannot be empty"
        if len(prompt) < self.MIN_PROMPT_LENGTH:
            return False, f"Prompt must be at least {self.MIN_PROMPT_LENGTH} characters"
        if len(prompt) > self.MAX_PROMPT_LENGTH:
            return False, f"Prompt cannot exceed {self.MAX_PROMPT_LENGTH} characters"
        inappropriate_words = ["violence", "hate", "porn", "explicit", "nsfw"]
        if any(word in prompt.lower() for word in inappropriate_words):
            return False, "Prompt contains inappropriate content"
        return True, None

    def _ensure_upload_dir(self) -> None:
        self.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    def _save_image_locally(self, image_data: bytes, prompt_slug: str) -> str:
        self._ensure_upload_dir()
        unique_id = str(uuid.uuid4())[:8]
        filename = f"{prompt_slug}_{unique_id}.png"
        filepath = self.UPLOAD_DIR / filename
        with open(filepath, "wb") as f:
            f.write(image_data)
        return f"/uploads/generated_images/{filename}"

    async def generate_image(self, prompt: str, thread_id: int, user: User, db: Session) -> dict:
        is_valid, error_msg = self.validate_prompt(prompt)
        if not is_valid:
            raise ValueError(error_msg)
        self._check_rate_limit(user.id)

        url = f"{self.proxy_url}/images/generations"
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        payload = {"model": self.model, "prompt": prompt, "n": 1, "size": "1024x1024", "response_format": "b64_json"}

        img_bytes: Optional[bytes] = None
        last_error: Optional[Exception] = None

        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=120.0) as client:
                    api_response = await client.post(url, json=payload, headers=headers)
                api_response.raise_for_status()
                response = api_response.json()
                data = response.get("data", [])
                if data:
                    b64 = data[0].get("b64_json")
                    if b64:
                        img_bytes = base64.b64decode(b64)
                        break
                    img_url = data[0].get("url")
                    if img_url:
                        async with httpx.AsyncClient(timeout=30.0) as c:
                            r = await c.get(img_url)
                        r.raise_for_status()
                        img_bytes = r.content
                        break
                raise RuntimeError(f"No image data in response: {response}")
            except Exception as err:
                last_error = err
                if attempt < 2:
                    await asyncio.sleep(2 * (attempt + 1))

        if not img_bytes:
            raise Exception(f"Failed to generate image: {last_error}")

        prompt_slug = "".join(c for c in prompt[:50].lower().replace(" ", "_") if c.isalnum() or c == "_")
        image_url = self._save_image_locally(img_bytes, prompt_slug)

        # Store base64 in DB for future editing/re-use without re-generating
        image_data_b64 = base64.b64encode(img_bytes).decode("utf-8")

        generated_image = GeneratedImage(
            thread_id=thread_id,
            user_id=user.id,
            prompt=prompt,
            image_url=image_url,
            image_data=image_data_b64,
        )
        db.add(generated_image)
        db.commit()
        db.refresh(generated_image)

        return {
            "generated_image_id": generated_image.id,
            "image_url": image_url,
            "prompt": prompt,
            "created_at": generated_image.created_at.isoformat(),
            "user_id": user.id,
            "thread_id": thread_id,
        }

    def get_generated_images_for_thread(self, thread_id: int, db: Session) -> list:
        """Return all GeneratedImage rows for a chat thread, ordered oldest first."""
        from sqlalchemy import select as sa_select
        stmt = (
            sa_select(GeneratedImage)
            .where(GeneratedImage.thread_id == thread_id)
            .order_by(GeneratedImage.created_at.asc())
        )
        return list(db.execute(stmt).scalars().all())


image_generation_service = ImageGenerationService()
