"""Messages API routes - Query message history."""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from datetime import datetime, timedelta
from uuid import UUID

from app.core.database import get_mongodb
from app.domain.entities.tenant import Tenant
from app.infrastructure.repositories.message_log_repository import MessageLogRepository
from app.api.schemas.message_log import (
    MessageLogResponse,
    ConversationHistory,
    MessageStats,
)
from app.api.dependencies.auth import get_current_tenant

router = APIRouter()


@router.get("/", response_model=List[MessageLogResponse])
async def list_messages(
    phone: Optional[str] = Query(None, description="Filter by sender phone"),
    session_id: Optional[str] = Query(None, description="Filter by session ID"),
    start_date: Optional[datetime] = Query(None, description="Start date filter"),
    end_date: Optional[datetime] = Query(None, description="End date filter"),
    limit: int = Query(50, ge=1, le=500, description="Maximum results"),
    current_tenant: Tenant = Depends(get_current_tenant)
):
    """
    List messages for the authenticated tenant with optional filters.
    """
    mongodb = get_mongodb()
    repo = MessageLogRepository(mongodb)
    tenant_id = str(current_tenant.id)
    
    if session_id:
        messages = await repo.get_by_session(tenant_id, session_id)
    elif phone:
        messages = await repo.get_by_phone(tenant_id, phone, limit=limit)
    elif start_date and end_date:
        messages = await repo.get_logs_by_date_range(tenant_id, start_date, end_date)
    else:
        # Default: last 7 days
        end = datetime.utcnow()
        start = end - timedelta(days=7)
        messages = await repo.get_logs_by_date_range(tenant_id, start, end)
    
    return [MessageLogResponse.model_validate(m.model_dump()) for m in messages[:limit]]


@router.get("/conversation/{session_id}", response_model=ConversationHistory)
async def get_conversation(
    session_id: str,
    limit: int = Query(50, ge=1, le=200, description="Number of messages"),
    current_tenant: Tenant = Depends(get_current_tenant)
):
    """
    Get conversation history for a specific session.
    """
    mongodb = get_mongodb()
    repo = MessageLogRepository(mongodb)
    tenant_id = str(current_tenant.id)
    
    # Get all messages in session
    all_messages = await repo.get_by_session(tenant_id, session_id)
    
    if not all_messages:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversa não encontrada"
        )
    
    # Limit and return
    limited = all_messages[-limit:] if len(all_messages) > limit else all_messages
    
    return ConversationHistory(
        tenant_id=tenant_id,
        session_id=session_id,
        messages=[MessageLogResponse.model_validate(m.model_dump()) for m in limited],
        total_count=len(all_messages)
    )


@router.get("/by-phone/{phone}", response_model=List[MessageLogResponse])
async def get_messages_by_phone(
    phone: str,
    limit: int = Query(50, ge=1, le=200, description="Number of messages"),
    current_tenant: Tenant = Depends(get_current_tenant)
):
    """
    Get message history for a specific phone number.
    """
    mongodb = get_mongodb()
    repo = MessageLogRepository(mongodb)
    tenant_id = str(current_tenant.id)
    
    messages = await repo.get_by_phone(tenant_id, phone, limit=limit)
    
    if not messages:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nenhuma mensagem encontrada para este número"
        )
    
    return [MessageLogResponse.model_validate(m.model_dump()) for m in messages]


@router.get("/stats", response_model=MessageStats)
async def get_message_stats(
    start_date: Optional[datetime] = Query(None, description="Start date"),
    end_date: Optional[datetime] = Query(None, description="End date"),
    current_tenant: Tenant = Depends(get_current_tenant)
):
    """
    Get message statistics for the authenticated tenant.
    """
    mongodb = get_mongodb()
    repo = MessageLogRepository(mongodb)
    tenant_id = str(current_tenant.id)
    
    # Default to last 30 days
    if not end_date:
        end_date = datetime.utcnow()
    if not start_date:
        start_date = end_date - timedelta(days=30)
    
    messages = await repo.get_logs_by_date_range(tenant_id, start_date, end_date)
    
    # Calculate stats
    total = len(messages)
    text_count = sum(1 for m in messages if m.message_type.value == "text")
    audio_count = sum(1 for m in messages if m.message_type.value == "audio")
    other_count = total - text_count - audio_count
    
    # Calculate average response time
    response_times = []
    for m in messages:
        if m.response_sent_at and m.processed_at:
            delta = (m.response_sent_at - m.processed_at).total_seconds()
            if delta > 0:
                response_times.append(delta)
    
    avg_response_time = sum(response_times) / len(response_times) if response_times else None
    
    return MessageStats(
        tenant_id=tenant_id,
        total_messages=total,
        text_messages=text_count,
        audio_messages=audio_count,
        other_messages=other_count,
        avg_response_time_seconds=avg_response_time,
        date_range_start=start_date,
        date_range_end=end_date
    )


@router.get("/recent", response_model=List[MessageLogResponse])
async def get_recent_messages(
    hours: int = Query(24, ge=1, le=168, description="Hours to look back"),
    limit: int = Query(100, ge=1, le=500, description="Maximum results"),
    current_tenant: Tenant = Depends(get_current_tenant)
):
    """
    Get recent messages from the last N hours.
    """
    mongodb = get_mongodb()
    repo = MessageLogRepository(mongodb)
    tenant_id = str(current_tenant.id)
    
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(hours=hours)
    
    messages = await repo.get_logs_by_date_range(tenant_id, start_date, end_date)
    
    return [MessageLogResponse.model_validate(m.model_dump()) for m in messages[:limit]]
