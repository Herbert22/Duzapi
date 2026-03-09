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


class BridgeWebhookPayload(BaseModel):
    """Payload received from our Node.js bridge (already processed)."""
    tenant_id: str = Field(..., description="Tenant UUID")
    session_id: str = Field(..., description="Bridge session ID")
    sender_phone: str = Field(..., description="Sender phone number")
    message_type: str = Field(..., description="Message type: text, audio")
    content: Optional[str] = Field(None, description="Message text content")
    audio_url: Optional[str] = Field(None, description="URL for audio file")
    message_id: Optional[str] = Field(None, description="WhatsApp message ID")
    timestamp: Optional[str] = Field(None, description="ISO timestamp")
    error: Optional[str] = Field(None, description="Error if media processing failed")


class WebhookResponse(BaseModel):
    """Response for webhook calls."""
    status: str
    message: str
    processing: bool = False


def map_bridge_type_to_message_type(bridge_type: str) -> MessageType:
    """Map bridge message type string to internal MessageType."""
    type_mapping = {
        "text": MessageType.TEXT,
        "audio": MessageType.AUDIO,
        "image": MessageType.IMAGE,
        "video": MessageType.VIDEO,
        "document": MessageType.DOCUMENT,
        "sticker": MessageType.STICKER,
    }
    return type_mapping.get(bridge_type, MessageType.TEXT)


async def _verify_bridge_signature(request: Request) -> None:
    """Raise HTTP 401 if the HMAC signature from the bridge is invalid."""
    from app.core.config import get_settings
    settings = get_settings()
    # In dev mode with default secret, skip verification to ease setup
    if settings.WEBHOOK_SECRET == "dev-webhook-secret-change-in-production":
        return
    signature = request.headers.get("X-Bridge-Signature", "")
    body = await request.body()
    if not verify_webhook_signature(body, signature):
        logger.warning("Invalid webhook signature rejected")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Assinatura de webhook inválida",
        )


@router.post("/whatsapp", response_model=WebhookResponse)
async def receive_whatsapp_message(
    request: Request,
    payload: BridgeWebhookPayload,
    db: AsyncSession = Depends(get_db),
):
    """Receive incoming WhatsApp messages from the Node.js bridge.

    Authenticates via HMAC signature, deduplicates by message ID,
    then queues processing through Celery.
    """
    await _verify_bridge_signature(request)

    logger.info(
        "Webhook received",
        extra={
            "tenant_id": payload.tenant_id,
            "sender_phone": payload.sender_phone,
            "message_type": payload.message_type,
        },
    )

    # Deduplicate by WhatsApp message ID (5-minute window)
    if payload.message_id:
        dedup_key = f"dedup:{payload.message_id}"
        if is_duplicate(dedup_key, ttl_seconds=300):
            logger.info("Duplicate message ignored", extra={"message_id": payload.message_id})
            return WebhookResponse(status="duplicate", message="Mensagem já processada")

    # Find tenant by ID
    tenant_repo = TenantRepository(db)
    tenant = await tenant_repo.get_by_id(payload.tenant_id)

    if not tenant:
        logger.warning("Tenant not found", extra={"tenant_id": payload.tenant_id})
        return WebhookResponse(status="error", message="Tenant não encontrado")

    if not tenant.is_active:
        return WebhookResponse(status="ignored", message="Tenant está inativo")

    # Get active bot config
    config_repo = BotConfigRepository(db)
    bot_config = await config_repo.get_active_by_tenant_id(tenant.id)
    if not bot_config:
        logger.warning("No active bot config", extra={"tenant_id": str(tenant.id)})
        return WebhookResponse(status="ignored", message="Nenhuma configuração de bot ativa")

    # Determine message type and content
    message_type = map_bridge_type_to_message_type(payload.message_type)
    content = payload.content or payload.audio_url or ""

    # Build session ID for conversation tracking
    session_id = f"{tenant.id}_{payload.sender_phone}"

    # Check trigger mode (skip if not matching)
    if message_type == MessageType.TEXT and not bot_config.should_respond(content):
        logger.info("Message filtered by trigger mode", extra={"trigger_mode": str(bot_config.trigger_mode)})
        return WebhookResponse(status="filtered", message="Mensagem não correspondeu aos critérios de gatilho")

    # Persist the incoming message log
    mongodb = get_mongodb()
    message_repo = MessageLogRepository(mongodb)
    message_log = MessageLog(
        tenant_id=str(tenant.id),
        session_id=session_id,
        sender_phone=payload.sender_phone,
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
            sender_phone=payload.sender_phone,
            message_type=message_type.value,
            content=content,
            bot_config_id=str(bot_config.id),
            bridge_session_id=payload.session_id,
        )
        logger.info("Message queued for Celery", extra={"session_id": session_id})
    except Exception as exc:
        logger.error("Failed to queue Celery task", extra={"error": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Fila de mensagens indisponível. Tente novamente.",
        )

    return WebhookResponse(
        status="accepted",
        message="Mensagem recebida e enfileirada para processamento",
        processing=True,
    )


@router.post("/whatsapp/status", response_model=WebhookResponse)
async def receive_whatsapp_status(request: Request):
    """Receive status updates (message acks, connection status, etc)."""
    logger.debug("Status webhook received")
    return WebhookResponse(status="received", message="Atualização de status recebida")
