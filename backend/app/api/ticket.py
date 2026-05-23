"""
Support ticket API routes — proxies submissions to the n8n workflow.
"""
from datetime import datetime, timezone
import logging
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from app.core.auth import get_current_user
from app.core.config import settings
from app.models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tickets", tags=["tickets"])


class TicketSubmissionRequest(BaseModel):
    requester_name: str = Field(min_length=2, max_length=120)
    requester_email: EmailStr
    subject: str = Field(min_length=4, max_length=200)
    description: str = Field(min_length=10, max_length=5000)
    category: str = Field(default="general", max_length=80)
    priority: str = Field(default="medium", pattern="^(low|medium|high|critical)$")
    department: str | None = Field(default=None, max_length=120)
    source: str = Field(default="web", max_length=50)
    metadata: dict[str, Any] = Field(default_factory=dict)


class TicketSubmissionResponse(BaseModel):
    success: bool
    message: str
    ticket_id: str | None = None
    category: str | None = None
    priority: str | None = None
    workflow_state: str | None = None
    workflow_response: dict[str, Any] | None = None
    sent_payload: dict[str, Any] | None = None


def _build_payload(request: TicketSubmissionRequest, current_user: User) -> dict[str, Any]:
    metadata = dict(request.metadata)
    metadata.update(
        {
            "submitted_by_user_id": current_user.id,
            "submitted_by_user_email": current_user.email,
            "submitted_by_user_name": current_user.name,
            "app_source": "amzur-chat",
            "submitted_at": datetime.now(timezone.utc).isoformat(),
        }
    )

    return {
        "requester_name": request.requester_name,
        "requester_email": request.requester_email,
        "subject": request.subject,
        "description": request.description,
        "category": request.category,
        "priority": request.priority,
        "department": request.department,
        "source": request.source,
        "metadata": metadata,
    }


@router.post("/submit", response_model=TicketSubmissionResponse)
async def submit_ticket(
    request: TicketSubmissionRequest,
    current_user: User = Depends(get_current_user),
) -> TicketSubmissionResponse:
    """Forward a support ticket to the configured n8n workflow."""
    webhook_url = settings.ticket_webhook_url
    if not webhook_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="N8N_TICKET_WEBHOOK_URL is not configured.",
        )

    payload = _build_payload(request, current_user)
    headers = settings.ticket_webhook_headers

    logger.info(f"Submitting ticket to n8n webhook: {webhook_url}")
    logger.info(f"Payload: {payload}")
    logger.info(f"Headers: {headers}")

    try:
        timeout = httpx.Timeout(30.0, connect=10.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(webhook_url, json=payload, headers=headers)
    except httpx.RequestError as exc:
        logger.exception("Failed to reach n8n ticket webhook")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to reach ticket workflow: {exc}",
        ) from exc

    if response.status_code >= 400:
        error_body = response.text.strip()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                f"Ticket workflow returned HTTP {response.status_code}."
                + (f" Body: {error_body}" if error_body else "")
            ),
        )

    workflow_response: dict[str, Any] | None = None
    content_type = response.headers.get("content-type", "")
    if "application/json" in content_type.lower():
        try:
            parsed = response.json()
            if isinstance(parsed, dict):
                workflow_response = parsed
            else:
                workflow_response = {"data": parsed}
        except ValueError:
            workflow_response = None

    ticket_id = None
    category = request.category
    priority = request.priority
    workflow_state = None

    if workflow_response:
        ticket_id = (
            workflow_response.get("ticket_id")
            or workflow_response.get("ticketId")
            or workflow_response.get("id")
            or workflow_response.get("issue_id")
        )
        category = workflow_response.get("category", category)
        priority = workflow_response.get("priority", priority)
        workflow_state = workflow_response.get("status") or workflow_response.get("state")

    return TicketSubmissionResponse(
        success=True,
        message="Ticket sent to the automation workflow successfully.",
        ticket_id=str(ticket_id) if ticket_id is not None else None,
        category=category,
        priority=priority,
        workflow_state=workflow_state,
        workflow_response=workflow_response,
        sent_payload=payload,
    )