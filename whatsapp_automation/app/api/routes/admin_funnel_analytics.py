"""Funnel Analytics API routes.

Protected by BRIDGE_AUTH_TOKEN (used by the Next.js admin panel).
Queries funnel_logs from MongoDB for lead tracking and conversion metrics.
"""

import asyncio
import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta, timezone

import httpx
import redis

from app.core.config import get_settings
from app.core.database import get_mongodb

router = APIRouter()
settings = get_settings()
logger = logging.getLogger(__name__)


async def verify_admin_token(
    authorization: Optional[str] = Header(None),
):
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization required")
    token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization
    if token != settings.BRIDGE_AUTH_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid admin token")


@router.get("/summary")
async def funnel_analytics_summary(
    _=Depends(verify_admin_token),
    db=Depends(get_mongodb),
):
    """Get funnel analytics summary: leads by period, completion rate."""
    collection = db["funnel_logs"]
    now = datetime.now(tz=timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    month_start = today_start.replace(day=1)

    # Count leads by period
    leads_today = await collection.count_documents({"started_at": {"$gte": today_start}})
    leads_week = await collection.count_documents({"started_at": {"$gte": week_start}})
    leads_month = await collection.count_documents({"started_at": {"$gte": month_start}})
    leads_total = await collection.count_documents({})

    # Status counts
    completed = await collection.count_documents({"status": "completed"})
    dropped = await collection.count_documents({"status": "dropped"})
    in_progress = await collection.count_documents({"status": "in_progress"})

    conversion_rate = round((completed / leads_total * 100), 1) if leads_total > 0 else 0

    return {
        "leads_today": leads_today,
        "leads_week": leads_week,
        "leads_month": leads_month,
        "leads_total": leads_total,
        "completed": completed,
        "dropped": dropped,
        "in_progress": in_progress,
        "conversion_rate": conversion_rate,
    }


@router.get("/contacts")
async def funnel_analytics_contacts(
    _=Depends(verify_admin_token),
    db=Depends(get_mongodb),
    funnel_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """List contacts with funnel progress details."""
    collection = db["funnel_logs"]

    query: dict = {}
    if funnel_id:
        query["funnel_id"] = funnel_id
    if status:
        query["status"] = status

    total = await collection.count_documents(query)

    cursor = collection.find(query).sort("started_at", -1).skip((page - 1) * limit).limit(limit)
    contacts = []
    msg_collection = db["message_logs"]
    async for doc in cursor:
        sender_phone = doc.get("sender_phone", "")
        # Try to resolve real phone number: first from funnel_log itself, then from message_logs
        real_phone = doc.get("sender_phone_number")
        session_id = doc.get("session_id", "")
        if not real_phone and session_id and "@lid" in sender_phone:
            msg_with_phone = await msg_collection.find_one(
                {"session_id": session_id, "sender_phone_number": {"$exists": True, "$ne": None}},
                {"sender_phone_number": 1},
            )
            if msg_with_phone:
                real_phone = msg_with_phone.get("sender_phone_number")

        contacts.append({
            "id": doc["_id"],
            "sender_phone": real_phone or sender_phone,
            "sender_phone_lid": sender_phone if real_phone else None,
            "funnel_name": doc.get("funnel_name", ""),
            "funnel_id": doc.get("funnel_id", ""),
            "status": doc.get("status", ""),
            "last_node_type": doc.get("last_node_type", ""),
            "last_node_label": doc.get("last_node_label", ""),
            "nodes_visited": doc.get("nodes_visited", []),
            "total_nodes": doc.get("total_nodes", 0),
            "variables": doc.get("variables", {}),
            "started_at": doc.get("started_at", ""),
            "completed_at": doc.get("completed_at"),
        })

    return {
        "contacts": contacts,
        "total": total,
        "page": page,
        "total_pages": (total + limit - 1) // limit if total > 0 else 1,
    }


def _get_bridge_session_for_tenant(tenant_id: str) -> Optional[str]:
    """Resolve bridge session name for a tenant via Redis tenant mapping.
    Only returns sessions that are currently connected (in known_sessions)."""
    try:
        r = redis.from_url(settings.REDIS_URL)
        known = r.smembers("bridge:known_sessions")
        known_set = {s.decode() if isinstance(s, bytes) else s for s in known}
        mapping = r.hgetall("bridge:tenant_mapping")
        for session_name, tid in mapping.items():
            session_str = session_name.decode() if isinstance(session_name, bytes) else session_name
            tid_str = tid.decode() if isinstance(tid, bytes) else tid
            if tid_str == tenant_id and session_str in known_set:
                return session_str
        return None
    except Exception as e:
        logger.error(f"Redis error resolving bridge session: {e}")
        return None


class SendMessageRequest(BaseModel):
    contact_ids: List[str]
    message: str


@router.post("/send-message")
async def send_message_to_contacts(
    body: SendMessageRequest,
    _=Depends(verify_admin_token),
    db=Depends(get_mongodb),
):
    """Send a WhatsApp message to selected funnel contacts."""
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Mensagem vazia")
    if len(body.contact_ids) > 50:
        raise HTTPException(status_code=400, detail="Maximo 50 contatos por vez")

    collection = db["funnel_logs"]
    sent = 0
    failed = 0
    errors = []

    # Cache bridge sessions per tenant
    session_cache: dict[str, Optional[str]] = {}

    async with httpx.AsyncClient(timeout=30) as client:
        for contact_id in body.contact_ids:
            doc = await collection.find_one({"_id": contact_id})
            if not doc:
                failed += 1
                continue

            tenant_id = doc.get("tenant_id", "")
            phone = doc.get("sender_phone", "")
            if not phone:
                failed += 1
                continue

            # Resolve bridge session for this tenant
            if tenant_id not in session_cache:
                session_cache[tenant_id] = _get_bridge_session_for_tenant(tenant_id)
            bridge_session = session_cache[tenant_id]

            if not bridge_session:
                failed += 1
                errors.append(f"Sem sessao bridge para tenant {tenant_id}")
                continue

            # Ensure phone has @lid or @c.us suffix
            if not phone.endswith("@lid") and not phone.endswith("@c.us"):
                phone = f"{phone}@c.us"

            try:
                url = f"{settings.WHATSAPP_BRIDGE_URL}/api/{bridge_session}/send-message"
                resp = await client.post(
                    url,
                    json={"phone": phone, "message": body.message},
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {settings.BRIDGE_AUTH_TOKEN}",
                    },
                )
                if resp.status_code in (200, 201):
                    sent += 1
                    # Update status to reengagement
                    await collection.update_one(
                        {"_id": contact_id},
                        {"$set": {"status": "reengagement"}},
                    )
                else:
                    failed += 1
                    errors.append(f"Bridge error {resp.status_code} for {phone}")
            except Exception as e:
                failed += 1
                errors.append(str(e))

            # Rate limit: 1 second between messages
            await asyncio.sleep(1)

    return {"sent": sent, "failed": failed, "errors": errors[:5]}
