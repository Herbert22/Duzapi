"""Admin Messages API routes — no tenant API key required.

Protected by BRIDGE_AUTH_TOKEN (used by the Next.js admin panel).
Queries message logs across ALL tenants from MongoDB.
"""

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timedelta

from app.core.config import get_settings
from app.core.database import get_mongodb
from app.infrastructure.repositories.message_log_repository import MessageLogRepository
from app.domain.entities.message_log import MessageLog
from app.api.schemas.message_log import MessageLogResponse, MessageStats

router = APIRouter()
settings = get_settings()


async def verify_admin_token(
    authorization: Optional[str] = Header(None),
):
    if not authorization:
        raise HTTPException(status_code=401, detail="Cabeçalho de autorização obrigatório")
    token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization
    if token != settings.BRIDGE_AUTH_TOKEN:
        raise HTTPException(status_code=401, detail="Token de admin inválido")


@router.get("/history")
async def list_all_messages(
    tenant_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=2000),
    offset: int = Query(0, ge=0),
    _=Depends(verify_admin_token),
):
    """List message logs across all tenants (admin)."""
    mongodb = get_mongodb()
    collection = mongodb["message_logs"]

    query = {}
    if tenant_id:
        query["tenant_id"] = tenant_id

    total = await collection.count_documents(query)

    cursor = (
        collection.find(query)
        .sort("processed_at", -1)
        .skip(offset)
        .limit(limit)
    )

    items = []
    async for doc in cursor:
        doc.pop("_id", None)
        try:
            items.append(MessageLogResponse.model_validate(doc))
        except Exception:
            continue

    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/stats", response_model=MessageStats)
async def get_global_stats(
    _=Depends(verify_admin_token),
):
    """Get global message statistics (admin)."""
    mongodb = get_mongodb()
    collection = mongodb["message_logs"]

    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=30)

    query = {"processed_at": {"$gte": start_date, "$lte": end_date}}
    cursor = collection.find(query).sort("processed_at", 1)

    messages = []
    async for doc in cursor:
        doc.pop("_id", None)
        messages.append(doc)

    total = len(messages)
    text_count = sum(1 for m in messages if m.get("message_type") == "text")
    audio_count = sum(1 for m in messages if m.get("message_type") == "audio")

    response_times = []
    for m in messages:
        if m.get("response_sent_at") and m.get("processed_at"):
            try:
                delta = (m["response_sent_at"] - m["processed_at"]).total_seconds()
                if delta > 0:
                    response_times.append(delta)
            except Exception:
                pass

    avg_response_time = sum(response_times) / len(response_times) if response_times else None

    return MessageStats(
        tenant_id="all",
        total_messages=total,
        text_messages=text_count,
        audio_messages=audio_count,
        other_messages=total - text_count - audio_count,
        avg_response_time_seconds=avg_response_time,
        date_range_start=start_date,
        date_range_end=end_date,
    )
