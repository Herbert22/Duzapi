"""
Celery Tasks for Funnel Execution — fully synchronous.

Tasks:
- execute_funnel_task: Start or resume funnel execution for a session
- resume_funnel_after_wait: Resume funnel after a wait node delay

All I/O uses sync clients (no asyncio inside Celery workers).
"""

import logging
import time
import base64
import uuid as _uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List

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
    global _sync_mongo_client
    if _sync_mongo_client is None:
        _sync_mongo_client = MongoClient(settings.MONGODB_URL)
    return _sync_mongo_client[settings.MONGODB_DB]


# ---------------------------------------------------------------------------
# Funnel session state management (MongoDB)
# ---------------------------------------------------------------------------

def _get_funnel_session(db, tenant_id: str, session_id: str) -> Optional[dict]:
    """Get active funnel session state."""
    return db["funnel_sessions"].find_one({
        "tenant_id": tenant_id,
        "session_id": session_id,
    })


def _create_funnel_session(db, tenant_id: str, session_id: str, funnel_id: str, start_node_id: str) -> dict:
    """Create a new funnel session."""
    doc = {
        "_id": str(_uuid.uuid4()),
        "tenant_id": tenant_id,
        "session_id": session_id,
        "funnel_id": funnel_id,
        "current_node_id": start_node_id,
        "variables": {},
        "tags": [],
        "waiting_for_input": False,
        "wait_until": None,
        "started_at": datetime.now(tz=timezone.utc),
        "updated_at": datetime.now(tz=timezone.utc),
    }
    db["funnel_sessions"].insert_one(doc)
    return doc


def _update_funnel_session(db, tenant_id: str, session_id: str, updates: dict):
    """Update funnel session state."""
    updates["updated_at"] = datetime.now(tz=timezone.utc)
    db["funnel_sessions"].update_one(
        {"tenant_id": tenant_id, "session_id": session_id},
        {"$set": updates},
    )


def _delete_funnel_session(db, tenant_id: str, session_id: str):
    """Remove funnel session (funnel completed or cancelled)."""
    db["funnel_sessions"].delete_one({
        "tenant_id": tenant_id,
        "session_id": session_id,
    })


# ---------------------------------------------------------------------------
# Funnel analytics logging (MongoDB — persistent, never deleted)
# ---------------------------------------------------------------------------

def _create_funnel_log(db, tenant_id: str, session_id: str, funnel_id: str,
                       funnel_name: str, sender_phone: str):
    """Create a persistent funnel execution log entry."""
    doc = {
        "_id": str(_uuid.uuid4()),
        "tenant_id": tenant_id,
        "session_id": session_id,
        "funnel_id": funnel_id,
        "funnel_name": funnel_name,
        "sender_phone": sender_phone,
        "status": "in_progress",
        "nodes_visited": [],
        "last_node_id": None,
        "last_node_type": None,
        "last_node_label": None,
        "variables": {},
        "started_at": datetime.now(tz=timezone.utc),
        "completed_at": None,
        "total_nodes": 0,
    }
    db["funnel_logs"].insert_one(doc)
    return doc


def _update_funnel_log_node(db, tenant_id: str, session_id: str,
                            node_id: str, node_type: str, node_label: str,
                            variables: dict = None):
    """Track node visit in funnel log."""
    updates: dict = {
        "last_node_id": node_id,
        "last_node_type": node_type,
        "last_node_label": node_label,
        "updated_at": datetime.now(tz=timezone.utc),
    }
    if variables:
        updates["variables"] = variables
    db["funnel_logs"].update_one(
        {"tenant_id": tenant_id, "session_id": session_id, "status": "in_progress"},
        {
            "$set": updates,
            "$push": {"nodes_visited": node_type},
            "$inc": {"total_nodes": 1},
        },
    )


def _complete_funnel_log(db, tenant_id: str, session_id: str, status: str = "completed"):
    """Mark funnel log as completed or dropped."""
    db["funnel_logs"].update_one(
        {"tenant_id": tenant_id, "session_id": session_id, "status": "in_progress"},
        {"$set": {
            "status": status,
            "completed_at": datetime.now(tz=timezone.utc),
        }},
    )


# ---------------------------------------------------------------------------
# Helpers: send media via Bridge (sync)
# ---------------------------------------------------------------------------

def _normalize_phone(phone: str) -> str:
    phone = phone.replace("+", "").replace("-", "").replace(" ", "")
    if not phone.endswith("@c.us") and not phone.endswith("@lid"):
        phone = f"{phone}@c.us"
    return phone


def _send_text(session_name: str, phone: str, text: str) -> bool:
    url = f"{settings.WHATSAPP_BRIDGE_URL}/api/{session_name}/send-message"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings.BRIDGE_AUTH_TOKEN}",
    }
    try:
        resp = req_lib.post(url, json={"phone": phone, "message": text}, headers=headers, timeout=30)
        return resp.status_code in (200, 201)
    except Exception as e:
        logger.error(f"Error sending text: {e}")
        return False


def _send_media(session_name: str, phone: str, media_type: str, media_base64: str,
                mime_type: str, caption: str = "", filename: str = "") -> bool:
    """Send image, video, or document via bridge."""
    endpoint_map = {
        "image": "send-image",
        "video": "send-video",
        "document": "send-document",
        "audio": "send-audio",
    }
    endpoint = endpoint_map.get(media_type)
    if not endpoint:
        logger.error(f"Unknown media type: {media_type}")
        return False

    url = f"{settings.WHATSAPP_BRIDGE_URL}/api/{session_name}/{endpoint}"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings.BRIDGE_AUTH_TOKEN}",
    }

    payload = {"phone": phone}
    if media_type == "image":
        payload["image_base64"] = media_base64
        payload["mime_type"] = mime_type
        payload["caption"] = caption
    elif media_type == "video":
        payload["video_base64"] = media_base64
        payload["mime_type"] = mime_type
        payload["caption"] = caption
    elif media_type == "document":
        payload["document_base64"] = media_base64
        payload["mime_type"] = mime_type
        payload["filename"] = filename or "document"
        payload["caption"] = caption
    elif media_type == "audio":
        payload["audio_base64"] = media_base64
        payload["mime_type"] = mime_type or "audio/ogg"

    try:
        resp = req_lib.post(url, json=payload, headers=headers, timeout=60)
        return resp.status_code in (200, 201)
    except Exception as e:
        logger.error(f"Error sending {media_type}: {e}")
        return False


def _load_media_as_base64(media_url: str) -> Optional[str]:
    """Load a media file from URL or local path and return as base64."""
    try:
        if media_url.startswith(("http://", "https://")):
            headers = {"Authorization": f"Bearer {settings.BRIDGE_AUTH_TOKEN}"}
            resp = req_lib.get(media_url, headers=headers, timeout=30)
            resp.raise_for_status()
            return base64.b64encode(resp.content).decode("utf-8")
        else:
            # Local file path (uploads directory)
            import os
            upload_dir = os.path.join(settings.BASE_DIR, "uploads")
            file_path = os.path.join(upload_dir, media_url.lstrip("/"))
            with open(file_path, "rb") as f:
                return base64.b64encode(f.read()).decode("utf-8")
    except Exception as e:
        logger.error(f"Failed to load media: {media_url} — {e}")
        return None


# ---------------------------------------------------------------------------
# Funnel graph loading (sync PostgreSQL)
# ---------------------------------------------------------------------------

def _load_funnel_graph(funnel_id: str) -> Optional[dict]:
    """Load funnel with all nodes and edges from PostgreSQL (sync)."""
    from uuid import UUID
    from app.domain.entities.funnel import Funnel, FunnelNode, FunnelEdge
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    with SyncSessionLocal() as db_session:
        funnel = db_session.get(Funnel, UUID(funnel_id))
        if not funnel:
            return None

        nodes_result = db_session.execute(
            select(FunnelNode).where(FunnelNode.funnel_id == UUID(funnel_id))
        )
        nodes = {str(n.id): {
            "id": str(n.id),
            "type": n.type.value if hasattr(n.type, 'value') else n.type,
            "data": n.data or {},
        } for n in nodes_result.scalars().all()}

        edges_result = db_session.execute(
            select(FunnelEdge).where(FunnelEdge.funnel_id == UUID(funnel_id))
            .order_by(FunnelEdge.sort_order)
        )
        edges = [{
            "id": str(e.id),
            "source_node_id": str(e.source_node_id),
            "target_node_id": str(e.target_node_id),
            "condition_label": e.condition_label,
            "condition_value": e.condition_value,
        } for e in edges_result.scalars().all()]

    return {
        "id": str(funnel.id),
        "tenant_id": str(funnel.tenant_id),
        "name": funnel.name,
        "nodes": nodes,
        "edges": edges,
    }


def _get_outgoing_edges(graph: dict, node_id: str) -> List[dict]:
    """Get all outgoing edges from a node."""
    return [e for e in graph["edges"] if e["source_node_id"] == node_id]


def _get_next_node_id(graph: dict, node_id: str) -> Optional[str]:
    """Get the next node (follows first outgoing edge)."""
    edges = _get_outgoing_edges(graph, node_id)
    if edges:
        return edges[0]["target_node_id"]
    return None


# ---------------------------------------------------------------------------
# Variable substitution
# ---------------------------------------------------------------------------

import re as _re

def _substitute_variables(text: str, variables: dict) -> str:
    """Replace {variable_name} placeholders with values; unknown vars become empty."""
    def _replacer(m):
        var_name = m.group(1)
        return str(variables.get(var_name, ""))
    return _re.sub(r"\{(\w+)\}", _replacer, text)


# ---------------------------------------------------------------------------
# Node execution logic
# ---------------------------------------------------------------------------

def _execute_node(
    graph: dict,
    node_id: str,
    session_state: dict,
    session_name: str,
    phone: str,
    user_input: Optional[str] = None,
    mongo_db=None,
) -> str:
    """Execute a funnel node and return status: 'continue', 'waiting', 'completed'."""
    node = graph["nodes"].get(node_id)
    if not node:
        logger.error(f"Node not found: {node_id}")
        return "completed"

    node_type = node["type"]
    data = node["data"]
    tenant_id = session_state["tenant_id"]
    session_id = session_state["session_id"]

    logger.info(f"Executing node: type={node_type}, id={node_id}, session={session_id}")

    # Track node visit in analytics log
    node_label = data.get("text", data.get("question", data.get("variable", "")))
    if isinstance(node_label, str) and len(node_label) > 50:
        node_label = node_label[:50]
    _update_funnel_log_node(
        mongo_db, tenant_id, session_id, node_id, node_type,
        node_label or node_type, session_state.get("variables"),
    )

    if node_type == "start":
        next_id = _get_next_node_id(graph, node_id)
        if next_id:
            _update_funnel_session(mongo_db, tenant_id, session_id, {"current_node_id": next_id})
            return "continue"
        return "completed"

    elif node_type == "send_text":
        text = data.get("text", "")
        if text:
            text = _substitute_variables(text, session_state.get("variables", {}))
            _send_text(session_name, phone, text)
        next_id = _get_next_node_id(graph, node_id)
        if next_id:
            _update_funnel_session(mongo_db, tenant_id, session_id, {"current_node_id": next_id})
            return "continue"
        return "completed"

    elif node_type in ("send_image", "send_video", "send_document"):
        media_url = data.get("media_url", "")
        caption = data.get("caption", "")
        media_b64 = _load_media_as_base64(media_url)
        if media_b64:
            media_map = {
                "send_image": ("image", "image/jpeg"),
                "send_video": ("video", "video/mp4"),
                "send_document": ("document", "application/pdf"),
            }
            m_type, m_mime = media_map[node_type]
            _send_media(session_name, phone, m_type, media_b64,
                        data.get("mime_type", m_mime), caption,
                        data.get("filename", ""))
        else:
            logger.warning(f"Could not load media: {media_url}")
        next_id = _get_next_node_id(graph, node_id)
        if next_id:
            _update_funnel_session(mongo_db, tenant_id, session_id, {"current_node_id": next_id})
            return "continue"
        return "completed"

    elif node_type == "send_audio":
        audio_url = data.get("audio_url", "")
        use_tts = data.get("use_tts", False)
        if use_tts:
            tts_text = data.get("tts_text", "")
            if tts_text:
                from .message_tasks import _generate_tts_audio_sync
                whisper_key = settings.OPENAI_API_KEY
                audio_b64 = _generate_tts_audio_sync(tts_text, whisper_key)
                if audio_b64:
                    _send_media(session_name, phone, "audio", audio_b64, "audio/ogg")
        elif audio_url:
            audio_b64 = _load_media_as_base64(audio_url)
            if audio_b64:
                _send_media(session_name, phone, "audio", audio_b64, "audio/ogg")
        next_id = _get_next_node_id(graph, node_id)
        if next_id:
            _update_funnel_session(mongo_db, tenant_id, session_id, {"current_node_id": next_id})
            return "continue"
        return "completed"

    elif node_type == "wait":
        delay_seconds = data.get("delay_seconds", 5)
        next_id = _get_next_node_id(graph, node_id)
        if next_id:
            wait_until = datetime.now(tz=timezone.utc) + timedelta(seconds=delay_seconds)
            _update_funnel_session(mongo_db, tenant_id, session_id, {
                "current_node_id": next_id,
                "wait_until": wait_until,
            })
            # Schedule resume task via Celery ETA
            resume_funnel_after_wait.apply_async(
                args=[tenant_id, session_id, session_name, phone],
                eta=wait_until,
            )
            return "waiting"
        return "completed"

    elif node_type == "ask":
        question = data.get("question", "")
        if question:
            question = _substitute_variables(question, session_state.get("variables", {}))
            _send_text(session_name, phone, question)

        timeout_seconds = data.get("timeout_seconds", 300)
        _update_funnel_session(mongo_db, tenant_id, session_id, {
            "waiting_for_input": True,
            "ask_variable": data.get("variable", ""),
            "ask_timeout_seconds": timeout_seconds,
        })

        # Schedule timeout: if user doesn't respond, auto-advance
        if timeout_seconds and timeout_seconds > 0:
            timeout_at = datetime.now(tz=timezone.utc) + timedelta(seconds=timeout_seconds)
            handle_ask_timeout.apply_async(
                args=[tenant_id, session_id, session_name, phone, node_id],
                eta=timeout_at,
            )

        return "waiting"

    elif node_type == "condition":
        # Evaluate conditions against variables
        conditions = data.get("conditions", [])
        answer = session_state.get("variables", {}).get(data.get("variable", ""), "")
        answer_lower = str(answer).lower().strip()

        edges = _get_outgoing_edges(graph, node_id)
        matched_edge = None

        for cond in conditions:
            operator = cond.get("operator", "contains")
            value = cond.get("value", "").lower().strip()
            edge_label = cond.get("edge_label", "")

            is_match = False
            if operator == "contains":
                is_match = value in answer_lower
            elif operator == "equals":
                is_match = answer_lower == value
            elif operator == "starts_with":
                is_match = answer_lower.startswith(value)

            if is_match and edge_label:
                # Find edge by condition_label (set from React Flow edge label)
                matched_edge = next(
                    (e for e in edges if (e.get("condition_label") or "").strip() == edge_label.strip()),
                    None,
                )
                if not matched_edge:
                    # Fallback: try matching by condition_value field
                    matched_edge = next(
                        (e for e in edges if (e.get("condition_value") or "").strip() == edge_label.strip()),
                        None,
                    )
                if matched_edge:
                    break
            elif is_match:
                # No edge_label specified — use first available edge
                if edges:
                    matched_edge = edges[0]
                    break

        # If no condition matched, use first edge without a condition (default path)
        if not matched_edge:
            matched_edge = next(
                (e for e in edges if not e.get("condition_label") and not e.get("condition_value")),
                None,
            )
        # Last resort: first edge
        if not matched_edge and edges:
            matched_edge = edges[0]

        if matched_edge:
            next_id = matched_edge["target_node_id"]
            _update_funnel_session(mongo_db, tenant_id, session_id, {"current_node_id": next_id})
            return "continue"
        return "completed"

    elif node_type == "tag":
        tag_name = data.get("tag_name", "")
        action = data.get("action", "add")
        if tag_name:
            tags = list(session_state.get("tags", []))
            if action == "add" and tag_name not in tags:
                tags.append(tag_name)
                # Persist to contact_tags table
                from app.domain.entities.funnel import ContactTag
                from uuid import UUID
                with SyncSessionLocal() as db_session:
                    ct = ContactTag(
                        tenant_id=UUID(tenant_id),
                        session_id=session_id,
                        tag=tag_name,
                        applied_by_funnel_id=UUID(session_state["funnel_id"]),
                    )
                    db_session.add(ct)
                    db_session.commit()
            elif action == "remove" and tag_name in tags:
                tags.remove(tag_name)
            _update_funnel_session(mongo_db, tenant_id, session_id, {"tags": tags})

        next_id = _get_next_node_id(graph, node_id)
        if next_id:
            _update_funnel_session(mongo_db, tenant_id, session_id, {"current_node_id": next_id})
            return "continue"
        return "completed"

    elif node_type == "ai_response":
        # Hybrid node — generate AI response using conversation context
        from .message_tasks import _generate_ai_response_sync, _get_conversation_history_sync
        from app.core.security import decrypt_value

        ai_system_prompt = data.get("system_prompt", "Você é um assistente virtual.")
        ai_provider = data.get("ai_provider", settings.AI_PROVIDER or "gemini")

        # Resolve API key
        api_key = None
        if ai_provider == "gemini" and settings.GOOGLE_API_KEY:
            api_key = settings.GOOGLE_API_KEY
        elif settings.OPENAI_API_KEY:
            api_key = settings.OPENAI_API_KEY

        if not api_key:
            _send_text(session_name, phone, "Erro: chave de API não configurada.")
        else:
            history = _get_conversation_history_sync(mongo_db, tenant_id, session_id)
            messages = []
            for msg in history:
                if msg.get("is_from_me"):
                    if msg.get("content"):
                        messages.append({"role": "assistant", "content": msg["content"]})
                else:
                    msg_content = msg.get("transcription") or msg.get("content", "")
                    if msg_content:
                        messages.append({"role": "user", "content": msg_content})

            if user_input and (not messages or messages[-1].get("content") != user_input):
                messages.append({"role": "user", "content": user_input})

            ai_response = _generate_ai_response_sync(
                messages, ai_system_prompt, api_key, provider=ai_provider
            )
            _send_text(session_name, phone, ai_response)

            # Log bot response
            now = datetime.now(tz=timezone.utc)
            mongo_db["message_logs"].insert_one({
                "_id": str(_uuid.uuid4()),
                "tenant_id": tenant_id,
                "session_id": session_id,
                "sender_phone": "",
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

        next_id = _get_next_node_id(graph, node_id)
        if next_id:
            _update_funnel_session(mongo_db, tenant_id, session_id, {"current_node_id": next_id})
            return "continue"
        return "completed"

    else:
        logger.warning(f"Unknown node type: {node_type}")
        return "completed"


# ---------------------------------------------------------------------------
# Funnel execution loop
# ---------------------------------------------------------------------------

def _run_funnel_loop(
    graph: dict,
    session_state: dict,
    session_name: str,
    phone: str,
    user_input: Optional[str] = None,
    mongo_db=None,
    max_steps: int = 50,
):
    """Execute funnel nodes in sequence until waiting or completed."""
    steps = 0
    while steps < max_steps:
        steps += 1
        current_node_id = session_state["current_node_id"]

        # Reload session state for latest data
        fresh_state = _get_funnel_session(mongo_db, session_state["tenant_id"], session_state["session_id"])
        if fresh_state:
            session_state.update(fresh_state)
            current_node_id = fresh_state["current_node_id"]

        result = _execute_node(
            graph, current_node_id, session_state,
            session_name, phone, user_input, mongo_db,
        )

        # Clear user_input after first node processes it (only relevant for ask/ai_response)
        user_input = None

        if result == "waiting":
            logger.info(f"Funnel paused at node {current_node_id} (waiting)")
            return "waiting"
        elif result == "completed":
            logger.info(f"Funnel completed for session {session_state['session_id']}")
            # Log completion before deleting session
            _complete_funnel_log(mongo_db, session_state["tenant_id"], session_state["session_id"], "completed")
            _delete_funnel_session(mongo_db, session_state["tenant_id"], session_state["session_id"])
            return "completed"

        # Small delay between consecutive messages to avoid WhatsApp rate limits
        time.sleep(0.5)

    logger.warning(f"Funnel loop hit max steps ({max_steps})")
    return "max_steps"


# ---------------------------------------------------------------------------
# Celery Tasks
# ---------------------------------------------------------------------------

@celery_app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def execute_funnel_task(
    self,
    tenant_id: str,
    session_id: str,
    sender_phone: str,
    funnel_id: str,
    bridge_session_id: str,
    user_input: Optional[str] = None,
    is_new: bool = True,
):
    """Start or resume funnel execution for a session."""
    logger.info(f"Funnel task: funnel={funnel_id}, session={session_id}, is_new={is_new}")

    mongo_db = _get_sync_mongo_db()
    phone = _normalize_phone(sender_phone)

    # Load funnel graph
    graph = _load_funnel_graph(funnel_id)
    if not graph:
        logger.error(f"Funnel not found: {funnel_id}")
        return {"success": False, "error": "funnel_not_found"}

    if is_new:
        # Find the start node
        start_node_id = None
        for nid, node in graph["nodes"].items():
            if node["type"] == "start":
                start_node_id = nid
                break

        if not start_node_id:
            logger.error(f"No start node in funnel: {funnel_id}")
            return {"success": False, "error": "no_start_node"}

        # Remove any existing funnel session
        _delete_funnel_session(mongo_db, tenant_id, session_id)
        # Mark any previous in_progress log as dropped
        _complete_funnel_log(mongo_db, tenant_id, session_id, "dropped")

        # Create new session state
        session_state = _create_funnel_session(
            mongo_db, tenant_id, session_id, funnel_id, start_node_id,
        )
        # Create persistent analytics log
        _create_funnel_log(
            mongo_db, tenant_id, session_id, funnel_id,
            graph.get("name", ""), phone,
        )
    else:
        # Resume existing session
        session_state = _get_funnel_session(mongo_db, tenant_id, session_id)
        if not session_state:
            logger.error(f"No funnel session to resume: {session_id}")
            return {"success": False, "error": "no_session"}

        # If was waiting for input (ask node), store the answer
        if session_state.get("waiting_for_input") and user_input:
            variable = session_state.get("ask_variable", "")
            variables = session_state.get("variables", {})
            if variable:
                variables[variable] = user_input
            _update_funnel_session(mongo_db, tenant_id, session_id, {
                "variables": variables,
                "waiting_for_input": False,
            })
            session_state["variables"] = variables
            session_state["waiting_for_input"] = False

            # Advance to next node after ask
            current_node_id = session_state["current_node_id"]
            next_id = _get_next_node_id(graph, current_node_id)
            if next_id:
                _update_funnel_session(mongo_db, tenant_id, session_id, {"current_node_id": next_id})
                session_state["current_node_id"] = next_id

    result = _run_funnel_loop(
        graph, session_state, bridge_session_id, phone,
        user_input=user_input if is_new else None,
        mongo_db=mongo_db,
    )

    return {"success": True, "result": result, "funnel_id": funnel_id}


@celery_app.task(bind=True, max_retries=3, default_retry_delay=10)
def resume_funnel_after_wait(
    self,
    tenant_id: str,
    session_id: str,
    session_name: str,
    phone: str,
):
    """Resume funnel execution after a wait node delay (called via Celery ETA)."""
    logger.info(f"Resuming funnel after wait: session={session_id}")

    mongo_db = _get_sync_mongo_db()
    session_state = _get_funnel_session(mongo_db, tenant_id, session_id)

    if not session_state:
        logger.info(f"Funnel session no longer exists: {session_id}")
        return {"success": False, "reason": "session_gone"}

    # Clear wait_until
    _update_funnel_session(mongo_db, tenant_id, session_id, {"wait_until": None})
    session_state["wait_until"] = None

    graph = _load_funnel_graph(session_state["funnel_id"])
    if not graph:
        logger.error(f"Funnel not found: {session_state['funnel_id']}")
        return {"success": False, "error": "funnel_not_found"}

    result = _run_funnel_loop(
        graph, session_state, session_name, phone, mongo_db=mongo_db,
    )

    return {"success": True, "result": result}


@celery_app.task(bind=True, max_retries=1)
def handle_ask_timeout(
    self,
    tenant_id: str,
    session_id: str,
    session_name: str,
    phone: str,
    ask_node_id: str,
):
    """Handle ask node timeout — if user hasn't responded, advance the funnel."""
    logger.info(f"Ask timeout check: session={session_id}, node={ask_node_id}")

    mongo_db = _get_sync_mongo_db()
    session_state = _get_funnel_session(mongo_db, tenant_id, session_id)

    if not session_state:
        return {"success": False, "reason": "session_gone"}

    # Only act if still waiting for input on the SAME ask node
    if not session_state.get("waiting_for_input"):
        logger.info("User already responded, timeout ignored")
        return {"success": False, "reason": "already_responded"}

    if session_state.get("current_node_id") != ask_node_id:
        logger.info("Funnel moved past this ask node, timeout ignored")
        return {"success": False, "reason": "node_changed"}

    # Timeout: advance to next node (skip the ask)
    _update_funnel_session(mongo_db, tenant_id, session_id, {
        "waiting_for_input": False,
    })

    graph = _load_funnel_graph(session_state["funnel_id"])
    if not graph:
        return {"success": False, "error": "funnel_not_found"}

    next_id = _get_next_node_id(graph, ask_node_id)
    if next_id:
        _update_funnel_session(mongo_db, tenant_id, session_id, {"current_node_id": next_id})
        session_state["current_node_id"] = next_id
        session_state["waiting_for_input"] = False

        result = _run_funnel_loop(
            graph, session_state, session_name, phone, mongo_db=mongo_db,
        )
        return {"success": True, "result": result}
    else:
        # No next node — funnel ends (timeout = dropped)
        _complete_funnel_log(mongo_db, tenant_id, session_id, "dropped")
        _delete_funnel_session(mongo_db, tenant_id, session_id)
        return {"success": True, "result": "completed"}
