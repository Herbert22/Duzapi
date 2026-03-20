"""Funnel Analytics API routes.

Protected by BRIDGE_AUTH_TOKEN (used by the Next.js admin panel).
Queries funnel_logs from MongoDB for lead tracking and conversion metrics.
"""

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from typing import Optional
from datetime import datetime, timedelta, timezone

from app.core.config import get_settings
from app.core.database import get_mongodb

router = APIRouter()
settings = get_settings()


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
    async for doc in cursor:
        contacts.append({
            "id": doc["_id"],
            "sender_phone": doc.get("sender_phone", ""),
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
