"""Admin Bot Configuration API routes — no tenant API key required.

Protected by BRIDGE_AUTH_TOKEN (used by the Next.js admin panel).
Lists/manages bot configs across ALL tenants.
"""

from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID

from app.core.config import get_settings
from app.core.database import get_db
from app.domain.entities.bot_config import BotConfig, TriggerMode
from app.infrastructure.repositories.bot_config_repository import BotConfigRepository
from app.api.schemas.bot_config import (
    BotConfigCreate,
    BotConfigUpdate,
    BotConfigResponse,
)

router = APIRouter()
settings = get_settings()


async def verify_admin_token(
    authorization: Optional[str] = Header(None),
):
    """Verify the admin/bridge auth token."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Cabeçalho de autorização obrigatório")

    token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization
    if token != settings.BRIDGE_AUTH_TOKEN:
        raise HTTPException(status_code=401, detail="Token de admin inválido")


@router.get("/", response_model=List[BotConfigResponse])
async def list_all_bot_configs(
    tenant_id: Optional[UUID] = None,
    _=Depends(verify_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """List bot configurations, optionally filtered by tenant."""
    query = select(BotConfig)
    if tenant_id:
        query = query.where(BotConfig.tenant_id == tenant_id)
    query = query.order_by(BotConfig.position.asc(), BotConfig.created_at.desc())
    result = await db.execute(query)
    configs = result.scalars().all()
    return [BotConfigResponse.from_orm_with_key_check(c) for c in configs]


@router.get("/{config_id}", response_model=BotConfigResponse)
async def get_bot_config(
    config_id: UUID,
    _=Depends(verify_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific bot configuration."""
    repo = BotConfigRepository(db)
    config = await repo.get_by_id(config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Configuração de bot não encontrada")
    return BotConfigResponse.from_orm_with_key_check(config)


@router.post("/", response_model=BotConfigResponse, status_code=201)
async def create_bot_config(
    config_data: BotConfigCreate,
    _=Depends(verify_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """Create a new bot configuration (admin)."""
    repo = BotConfigRepository(db)
    bot_config = BotConfig(
        tenant_id=config_data.tenant_id,
        persona_name=config_data.persona_name,
        system_prompt=config_data.system_prompt,
        response_delay_min=config_data.response_delay_min,
        response_delay_max=config_data.response_delay_max,
        trigger_mode=TriggerMode(config_data.trigger_mode.value),
        trigger_keywords=config_data.trigger_keywords,
        openai_api_key=config_data.openai_api_key,
        is_active=config_data.is_active,
        initial_message=config_data.initial_message,
        enable_audio_response=config_data.enable_audio_response,
        position=config_data.position,
    )
    if hasattr(config_data, "ai_provider") and config_data.ai_provider:
        bot_config.ai_provider = config_data.ai_provider.value
    created = await repo.create(bot_config)
    return BotConfigResponse.from_orm_with_key_check(created)


@router.put("/{config_id}", response_model=BotConfigResponse)
async def update_bot_config(
    config_id: UUID,
    config_data: BotConfigUpdate,
    _=Depends(verify_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """Update a bot configuration (admin)."""
    repo = BotConfigRepository(db)
    config = await repo.get_by_id(config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Configuração de bot não encontrada")

    update_data = config_data.model_dump(exclude_unset=True)
    if "trigger_mode" in update_data and update_data["trigger_mode"]:
        update_data["trigger_mode"] = TriggerMode(update_data["trigger_mode"].value)
    if "ai_provider" in update_data and update_data["ai_provider"]:
        update_data["ai_provider"] = update_data["ai_provider"].value

    # Don't overwrite the encrypted API key with empty string
    if "openai_api_key" in update_data and not update_data["openai_api_key"]:
        del update_data["openai_api_key"]

    for field, value in update_data.items():
        setattr(config, field, value)

    updated = await repo.update(config)
    return BotConfigResponse.from_orm_with_key_check(updated)


@router.put("/reorder", status_code=200)
async def reorder_bot_configs(
    items: List[dict],
    _=Depends(verify_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """Reorder bot configurations (drag-and-drop). Expects [{id, position}, ...]."""
    repo = BotConfigRepository(db)
    for item in items:
        config = await repo.get_by_id(UUID(str(item["id"])))
        if config:
            config.position = item["position"]
            await repo.update(config)
    return {"success": True}


@router.delete("/{config_id}", status_code=204)
async def delete_bot_config(
    config_id: UUID,
    _=Depends(verify_admin_token),
    db: AsyncSession = Depends(get_db),
):
    """Delete a bot configuration (admin)."""
    repo = BotConfigRepository(db)
    config = await repo.get_by_id(config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Configuração de bot não encontrada")
    await repo.delete(config_id)
    return None
