"""
Image generation API routes — handles AI image generation requests.
"""
from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.session import get_db_session
from app.core.auth import get_current_user
from app.models import User, Chat
from app.schemas.chat import ImageGenerationRequest
from app.services.image_generation_service import image_generation_service

router = APIRouter(prefix="/api", tags=["image-generation"])


async def _get_owned_chat(chat_id: int, user_id: int, db: Session) -> Chat:
    """Helper to verify user owns the chat."""
    stmt = select(Chat).where(Chat.id == chat_id, Chat.user_id == user_id)
    chat = db.execute(stmt).scalars().first()
    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found",
        )
    return chat


@router.post("/generate-image")
async def generate_image(
    request: ImageGenerationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> dict:
    """
    Generate an AI image from a text prompt using Google Gemini 2.0.
    
    Request body:
    {
        "prompt": "A futuristic city at night",
        "thread_id": 123
    }
    
    Returns:
    {
        "success": true,
        "generated_image_id": 456,
        "image_url": "/uploads/generated_images/a_futuristic_city_at_night_abc123.png",
        "prompt": "A futuristic city at night",
        "created_at": "2024-05-08T12:34:56.789Z",
        "user_id": 1,
        "thread_id": 123
    }
    """
    try:
        # Verify user owns the chat thread
        await _get_owned_chat(request.thread_id, current_user.id, db)

        # Generate the image
        result = await image_generation_service.generate_image(
            prompt=request.prompt,
            thread_id=request.thread_id,
            user=current_user,
            db=db,
        )

        return {
            "success": True,
            **result,
        }

    except ValueError as e:
        # Validation errors (prompt issues)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        # Other errors (API failures, DB issues, etc.)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/generated-images/{thread_id}")
async def get_generated_images(
    thread_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> dict:
    """
    Retrieve all generated images for a specific chat thread.
    
    Returns:
    {
        "success": true,
        "generated_images": [
            {
                "id": 456,
                "prompt": "A futuristic city at night",
                "image_url": "/uploads/generated_images/...",
                "created_at": "2024-05-08T12:34:56.789Z"
            }
        ]
    }
    """
    try:
        # Verify user owns the chat thread
        await _get_owned_chat(thread_id, current_user.id, db)

        # Get all generated images for the thread
        images = image_generation_service.get_generated_images_for_thread(thread_id, db)

        return {
            "success": True,
            "generated_images": [
                {
                    "id": img.id,
                    "prompt": img.prompt,
                    "image_url": img.image_url,
                    "created_at": img.created_at.isoformat(),
                }
                for img in images
            ],
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve generated images: {str(e)}",
        )
