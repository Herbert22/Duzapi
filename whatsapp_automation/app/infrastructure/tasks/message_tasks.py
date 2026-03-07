"""
Celery Tasks for Message Processing — fully synchronous.

Tasks:
- process_and_respond_task: Process message and send delayed response
- send_whatsapp_message_task: Send message via WPPConnect bridge

All I/O uses sync clients (SyncSessionLocal for PostgreSQL, pymongo for MongoDB,
requests for HTTP) so there is no async event-loop inside Celery workers.
"""

import os
import random
import logging
import time
import tempfile
import uuid as _uuid
from datetime import datetime, timezone
from typing import Optional

import requests as req_lib
from pymongo import MongoClient

from .celery_app import celery_app
from app.core.config import settings
from app.core.database import SyncSessionLocal

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Module-level MongoDB client (one per Celery worker process)
# ---------------------------------------------------------------------------

_sync_mongo_client: Optional[MongoClient] = None


def _get_sync_mongo_db():
    """Return a sync pymongo Database, initialising the client if needed."""
    global _sync_mongo_client
    if _sync_mongo_client is None:
        _sync_mongo_client = MongoClient(settings.MONGODB_URL)
    return _sync_mongo_client[settings.MONGODB_DB]


# ---------------------------------------------------------------------------
# Helper: conversation history
# ---------------------------------------------------------------------------

def _get_conversation_history_sync(db, tenant_id: str, session_id: str, limit: int = 10) -> list:
    cursor = (
        db["message_logs"]
        .find({"tenant_id": tenant_id, "session_id": session_id})
        .sort("processed_at", -1)
        .limit(limit)
    )
    docs = list(cursor)
    for doc in docs:
        doc.pop("_id", None)
    return list(reversed(docs))  # chronological order


# ---------------------------------------------------------------------------
# Helper: audio transcription (sync openai)
# ---------------------------------------------------------------------------

def _transcribe_audio_sync(audio_url: str, api_key: str) -> str:
    """Download audio file and transcribe via OpenAI Whisper (sync)."""
    from openai import OpenAI

    tmp_path = None
    try:
        # Download the audio file (may require bridge auth token)
        headers = {"Authorization": f"Bearer {settings.BRIDGE_AUTH_TOKEN}"}
        resp = req_lib.get(audio_url, headers=headers, timeout=30, stream=True)
        resp.raise_for_status()

        with tempfile.NamedTemporaryFile(suffix=".ogg", delete=False) as tmp:
            for chunk in resp.iter_content(chunk_size=8192):
                tmp.write(chunk)
            tmp_path = tmp.name

        client = OpenAI(api_key=api_key)
        with open(tmp_path, "rb") as f:
            result = client.audio.transcriptions.create(
                model="whisper-1",
                file=f,
                language="pt",
            )
        return result.text

    except Exception as e:
        logger.error(f"Audio transcription failed: {e}")
        return "[Áudio não pôde ser transcrito]"
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


# ---------------------------------------------------------------------------
# Helper: AI response (sync — supports Gemini and OpenAI)
# ---------------------------------------------------------------------------

def _generate_ai_response_sync(
    messages: list,
    system_prompt: str,
    api_key: str,
    provider: str = "gemini",
    model: str = None,
) -> str:
    try:
        if provider == "gemini":
            return _gemini_chat_sync(messages, system_prompt, api_key, model)
        else:
            return _openai_chat_sync(messages, system_prompt, api_key, model)
    except Exception as e:
        logger.error(f"AI request failed ({provider}): {e}")
        return "Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente."


def _gemini_chat_sync(messages: list, system_prompt: str, api_key: str, model: str = None) -> str:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)
    model_name = model or "gemini-2.5-flash-lite"

    contents = []
    for msg in messages:
        role = "model" if msg["role"] == "assistant" else "user"
        contents.append(types.Content(role=role, parts=[types.Part(text=msg["content"])]))

    config = types.GenerateContentConfig(
        system_instruction=system_prompt,
        max_output_tokens=1000,
        temperature=0.7,
    )

    response = client.models.generate_content(
        model=model_name,
        contents=contents,
        config=config,
    )
    return response.text


def _openai_chat_sync(messages: list, system_prompt: str, api_key: str, model: str = None) -> str:
    from openai import OpenAI

    client = OpenAI(api_key=api_key)
    model_name = model or "gpt-4o-mini"

    openai_messages = [{"role": "system", "content": system_prompt}]
    openai_messages.extend(messages)

    response = client.chat.completions.create(
        model=model_name,
        messages=openai_messages,
        temperature=0.7,
        max_tokens=1000,
    )
    return response.choices[0].message.content


# ---------------------------------------------------------------------------
# Helper: send WhatsApp message (sync requests)
# ---------------------------------------------------------------------------

def _send_whatsapp_message_sync(session_name: str, to_phone: str, message: str) -> bool:
    phone = to_phone.replace("+", "").replace("-", "").replace(" ", "")
    # Handle @lid (Linked ID) and @c.us formats from WhatsApp
    if not phone.endswith("@c.us") and not phone.endswith("@lid"):
        phone = f"{phone}@c.us"
    session = session_name

    url = f"{settings.WHATSAPP_BRIDGE_URL}/api/{session}/send-message"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings.BRIDGE_AUTH_TOKEN}",
    }
    payload = {"phone": phone, "message": message}

    try:
        resp = req_lib.post(url, json=payload, headers=headers, timeout=30)
        if resp.status_code in (200, 201):
            logger.info(f"Message sent to {to_phone}")
            return True
        logger.error(f"Bridge error: status={resp.status_code}, body={resp.text[:200]}")
        return False
    except req_lib.exceptions.Timeout:
        logger.error(f"Timeout sending message to {to_phone}")
        return False
    except Exception as e:
        logger.error(f"Error sending message: {e}")
        return False


# ---------------------------------------------------------------------------
# Main Celery task
# ---------------------------------------------------------------------------

@celery_app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def process_and_respond_task(
    self,
    tenant_id: str,
    session_id: str,
    sender_phone: str,
    message_type: str,
    content: str,
    bot_config_id: str,
    bridge_session_id: str = "",
):
    """
    Process incoming message and send AI response with humanised delay.

    Fully synchronous — no asyncio inside Celery workers.
    """
    logger.info(
        "Processing message task",
        extra={"tenant_id": tenant_id, "session_id": session_id, "message_type": message_type},
    )

    from uuid import UUID
    from app.domain.entities.bot_config import BotConfig, TriggerMode
    from app.domain.entities.tenant import Tenant
    from app.core.security import decrypt_value

    # ------------------------------------------------------------------
    # 1. Load BotConfig + Tenant from PostgreSQL (sync)
    # ------------------------------------------------------------------
    with SyncSessionLocal() as db_session:
        bot_config = db_session.get(BotConfig, UUID(bot_config_id))
        if not bot_config:
            raise ValueError(f"Bot config not found: {bot_config_id}")

        tenant = db_session.get(Tenant, UUID(tenant_id))
        if not tenant:
            raise ValueError(f"Tenant not found: {tenant_id}")

        delay_min = bot_config.response_delay_min
        delay_max = bot_config.response_delay_max
        system_prompt = bot_config.system_prompt
        trigger_mode = bot_config.trigger_mode
        trigger_keywords = list(bot_config.trigger_keywords or [])
        raw_api_key = bot_config.openai_api_key
        ai_provider = getattr(bot_config, "ai_provider", None) or settings.AI_PROVIDER
        tenant_phone = tenant.phone_number

    # Resolve API key based on provider (must be set in bot config)
    if raw_api_key:
        api_key = decrypt_value(raw_api_key)
    elif ai_provider == "gemini" and settings.GOOGLE_API_KEY:
        api_key = settings.GOOGLE_API_KEY
    elif ai_provider == "openai" and settings.OPENAI_API_KEY:
        api_key = settings.OPENAI_API_KEY
    else:
        api_key = None

    if not api_key:
        logger.error(f"No API key configured for provider '{ai_provider}' in bot config {bot_config_id}")
        # Send error message to user
        _send_whatsapp_message_sync(
            session_name=bridge_session_id or tenant_phone,
            to_phone=sender_phone,
            message="Configuração incompleta: a chave da API de IA não foi definida. Entre em contato com o administrador.",
        )
        return {"success": False, "error": "No API key configured"}

    # ------------------------------------------------------------------
    # 2. Process content (transcribe audio if needed)
    # ------------------------------------------------------------------
    processed_content = content
    transcription = None
    mongo_db = _get_sync_mongo_db()

    if message_type == "audio":
        logger.info(f"Transcribing audio for session: {session_id}")
        # Whisper always uses OpenAI key
        whisper_key = settings.OPENAI_API_KEY or api_key
        transcription = _transcribe_audio_sync(content, whisper_key)
        processed_content = transcription

        # Persist transcription to MongoDB
        mongo_db["message_logs"].update_one(
            {
                "tenant_id": tenant_id,
                "session_id": session_id,
                "message_type": "audio",
                "transcription": None,
            },
            {"$set": {"transcription": transcription}},
        )

    # ------------------------------------------------------------------
    # 3. Check trigger conditions
    # ------------------------------------------------------------------
    if trigger_mode == TriggerMode.KEYWORDS:
        content_lower = processed_content.lower()
        if not any(kw.lower() in content_lower for kw in trigger_keywords):
            logger.info(f"Message filtered by trigger mode: {session_id}")
            return {"success": False, "reason": "trigger_not_matched"}

    # ------------------------------------------------------------------
    # 4. Retrieve conversation history (sync)
    # ------------------------------------------------------------------
    history = _get_conversation_history_sync(mongo_db, tenant_id, session_id)
    logger.info(f"History loaded: {len(history)} messages for session {session_id}")

    # ------------------------------------------------------------------
    # 5. Build context for AI
    # ------------------------------------------------------------------
    messages = []
    for msg in history:
        if msg.get("is_from_me"):
            # Outgoing bot message — "content" holds the AI reply text
            if msg.get("content"):
                messages.append({"role": "assistant", "content": msg["content"]})
        else:
            msg_content = msg.get("transcription") or msg.get("content", "")
            if msg_content:
                messages.append({"role": "user", "content": msg_content})

    # Avoid duplicating the current message if it's already in history
    if not messages or messages[-1].get("content") != processed_content:
        messages.append({"role": "user", "content": processed_content})

    logger.info(f"AI context: {len(messages)} messages (roles: {[m['role'] for m in messages]})")

    # ------------------------------------------------------------------
    # 6. Generate AI response
    # ------------------------------------------------------------------
    ai_response = _generate_ai_response_sync(messages, system_prompt, api_key, provider=ai_provider)

    # ------------------------------------------------------------------
    # 7. Update incoming message log with AI response
    # ------------------------------------------------------------------
    now = datetime.now(tz=timezone.utc)
    mongo_db["message_logs"].update_one(
        {
            "tenant_id": tenant_id,
            "session_id": session_id,
            "is_from_me": False,
            "ai_response": None,
        },
        {"$set": {"ai_response": ai_response, "response_sent_at": now}},
    )

    # ------------------------------------------------------------------
    # 8. Humanised delay (typing simulation)
    # ------------------------------------------------------------------
    delay_seconds = random.uniform(delay_min, delay_max)
    logger.info(f"Humanised delay: {delay_seconds:.2f}s for session {session_id}")
    time.sleep(delay_seconds)

    # ------------------------------------------------------------------
    # 9. Send via Bridge
    # ------------------------------------------------------------------
    # Use bridge session ID if available, fall back to tenant phone
    send_session = bridge_session_id or tenant_phone
    send_success = _send_whatsapp_message_sync(
        session_name=send_session,
        to_phone=sender_phone,
        message=ai_response,
    )

    if send_success:
        # Log the bot's outgoing message
        mongo_db["message_logs"].insert_one({
            "_id": str(_uuid.uuid4()),
            "tenant_id": tenant_id,
            "session_id": session_id,
            "sender_phone": tenant_phone,
            "message_type": "text",
            "content": ai_response,
            "transcription": None,
            "ai_response": None,
            "processed_at": now,
            "response_sent_at": None,
            "message_id": None,
            "is_from_me": True,
            "error": None,
        })

    return {
        "success": True,
        "sent": send_success,
        "delay_applied": round(delay_seconds, 2),
        "transcription": transcription,
        "response_preview": ai_response[:100],
    }


# ---------------------------------------------------------------------------
# Standalone send task (for direct calls without full processing)
# ---------------------------------------------------------------------------

@celery_app.task(
    bind=True,
    max_retries=5,
    default_retry_delay=30,
)
def send_whatsapp_message_task(self, session_name: str, to_phone: str, message: str):
    """Send a WhatsApp message without processing — direct delivery."""
    logger.info(f"Sending WhatsApp message: to={to_phone}")
    try:
        success = _send_whatsapp_message_sync(session_name, to_phone, message)
        return {"success": success, "to": to_phone}
    except Exception as e:
        logger.error(f"Send message task failed: {e}")
        raise self.retry(exc=e)
