"""Webhook API routes - Receive WhatsApp messages from bridge."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from typing import Optional
import logging

from app.core.database import get_db, get_mongodb
from app.core.security import verify_webhook_signature
from app.core.redis_client import is_duplicate
from app.infrastructure.repositories.tenant_repository import TenantRepository
from app.infrastructure.repositories.bot_config_repository import BotConfigRepository
from app.infrastructure.repositories.message_log_repository import MessageLogRepository
from app.domain.entities.message_log import MessageLog, MessageType
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

router = APIRouter()


class WhatsAppWebhookPayload(BaseModel):
    """Payload received from WPPConnect bridge."""
    event: str = Field(..., description="Event type (message, ack, etc)")
    session: str = Field(..., description="WhatsApp session name (phone number)")

    # Message data
    from_number: Optional[str] = Field(None, alias="from", description="Sender phone number")
    to_number: Optional[str] = Field(None, alias="to", description="Receiver phone number")
    body: Optional[str] = Field(None, description="Message content")
    type: Optional[str] = Field(None, description="Message type (chat, ptt, audio, etc)")
    message_id: Optional[str] = Field(None, alias="id", description="WhatsApp message ID")
    timestamp: Optional[int] = Field(None, description="Unix timestamp")
    is_group: Optional[bool] = Field(False, description="Whether message is from group")

    # Media data
    media_url: Optional[str] = Field(None, description="URL for media content")
    mime_type: Optional[str] = Field(None, description="MIME type of media")

    class Config:
        populate_by_name = True


class WebhookResponse(BaseModel):
    """Response for webhook calls."""
    status: str
    message: str
    processing: bool = False


def map_whatsapp_type_to_message_type(wa_type: str) -> MessageType:
    """Map WhatsApp message type to internal MessageType."""
    type_mapping = {
        "chat": MessageType.TEXT,
        "ptt": MessageType.AUDIO,
        "audio": MessageType.AUDIO,
        "image": MessageType.IMAGE,
        "video": MessageType.VIDEO,
        "document": MessageType.DOCUMENT,
        "sticker": MessageType.STICKER,
        "location": MessageType.LOCATION,
        "vcard": MessageType.CONTACT,
    }
    return type_mapping.get(wa_type, MessageType.TEXT)


async def _verify_bridge_signature(request: Request) -> None:
    """Raise HTTP 401 if the HMAC signature from the bridge is invalid."""
    from app.core.config import settings
    # In dev mode with default secret, skip verification to ease setup
    if settings.WEBHOOK_SECRET == "dev-webhook-secret-change-in-production":
        return
    signature = request.headers.get("X-Bridge-Signature", "")
    body = await request.body()
    if not verify_webhook_signature(body, signature):
        logger.warning("Invalid webhook signature rejected")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook signature",
        )


@router.post("/whatsapp", response_model=WebhookResponse)
async def receive_whatsapp_message(
    request: Request,
    payload: WhatsAppWebhookPayload,
    db: AsyncSession = Depends(get_db),
):
    """Receive incoming WhatsApp messages from WPPConnect bridge.

    Authenticates via HMAC signature, deduplicates by message ID,
    then queues processing through Celery.
    """
    await _verify_bridge_signature(request)

    logger.info(
        "Webhook received",
        extra={"event": payload.event, "session": payload.session},
    )

    # Only process incoming messages
    if payload.event != "message":
        return WebhookResponse(
            status="ignored",
            message=f"Event type '{payload.event}' ignored",
        )

    # Skip group messages
    if payload.is_group:
        return WebhookResponse(status="ignored", message="Group messages not supported")

    # Deduplicate by WhatsApp message ID (5-minute window)
    if payload.message_id:
        dedup_key = f"dedup:{payload.message_id}"
        if is_duplicate(dedup_key, ttl_seconds=300):
            logger.info("Duplicate message ignored", extra={"message_id": payload.message_id})
            return WebhookResponse(status="duplicate", message="Message already processed")

    # Find tenant by session (phone number)
    tenant_repo = TenantRepository(db)
    phone_number = payload.session.replace("@c.us", "").replace("-", "")
    tenant = await tenant_repo.get_by_phone(phone_number)
    if not tenant:
        tenant = await tenant_repo.get_by_phone(f"+{phone_number}")

    if not tenant:
        logger.warning("Tenant not found", extra={"session": payload.session})
        return WebhookResponse(status="error", message="Tenant not found")

    if not tenant.is_active:
        return WebhookResponse(status="ignored", message="Tenant is inactive")

    # Get active bot config
    config_repo = BotConfigRepository(db)
    bot_config = await config_repo.get_active_by_tenant_id(tenant.id)
    if not bot_config:
        logger.warning("No active bot config", extra={"tenant_id": str(tenant.id)})
        return WebhookResponse(status="ignored", message="No active bot configuration")

    # Determine message type and content
    message_type = map_whatsapp_type_to_message_type(payload.type or "chat")
    content = payload.body or payload.media_url or ""

    # Build session ID
    sender_phone = (payload.from_number or "").replace("@c.us", "").replace("@s.whatsapp.net", "")
    session_id = f"{tenant.id}_{sender_phone}"

    # Check trigger mode (skip if not matching)
    if not bot_config.should_respond(content):
        logger.info("Message filtered by trigger mode", extra={"trigger_mode": bot_config.trigger_mode})
        return WebhookResponse(status="filtered", message="Message did not match trigger criteria")

    # Persist the incoming message log
    mongodb = get_mongodb()
    message_repo = MessageLogRepository(mongodb)
    message_log = MessageLog(
        tenant_id=str(tenant.id),
        session_id=session_id,
        sender_phone=sender_phone,
        message_type=message_type,
        content=content,
        message_id=payload.message_id,
        is_from_me=False,
    )
    await message_repo.create(message_log)

    # Dispatch to Celery (reliable, retryable)
    try:
        from app.infrastructure.tasks.message_tasks import process_and_respond_task
        process_and_respond_task.delay(
            tenant_id=str(tenant.id),
            session_id=session_id,
            sender_phone=sender_phone,
            message_type=message_type.value,
            content=content,
            bot_config_id=str(bot_config.id),
        )
        logger.info("Message queued for Celery", extra={"session_id": session_id})
    except Exception as exc:
        logger.error("Failed to queue Celery task", extra={"error": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Message queue unavailable. Please retry.",
        )

    return WebhookResponse(
        status="accepted",
        message="Message received and queued for processing",
        processing=True,
    )


@router.post("/whatsapp/status", response_model=WebhookResponse)
async def receive_whatsapp_status(request: Request):
    """Receive status updates (message acks, connection status, etc)."""
    logger.debug("Status webhook received")
    return WebhookResponse(status="received", message="Status update received")
