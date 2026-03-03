"""Bot Configuration API routes - CRUD operations per tenant."""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID

from app.core.database import get_db
from app.domain.entities.tenant import Tenant
from app.domain.entities.bot_config import BotConfig, TriggerMode
from app.infrastructure.repositories.bot_config_repository import BotConfigRepository
from app.infrastructure.repositories.tenant_repository import TenantRepository
from app.api.schemas.bot_config import (
    BotConfigCreate,
    BotConfigUpdate,
    BotConfigResponse,
)
from app.api.dependencies.auth import get_current_tenant

router = APIRouter()


@router.post("/", response_model=BotConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_bot_config(
    config_data: BotConfigCreate,
    current_tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    """Create a new bot configuration for the authenticated tenant."""
    # Verify tenant_id matches authenticated tenant
    if config_data.tenant_id != current_tenant.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot create config for another tenant"
        )
    
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
        is_active=config_data.is_active
    )
    
    created = await repo.create(bot_config)
    return BotConfigResponse.from_orm_with_key_check(created)


@router.get("/", response_model=List[BotConfigResponse])
async def list_bot_configs(
    current_tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    """List all bot configurations for the authenticated tenant."""
    repo = BotConfigRepository(db)
    configs = await repo.get_by_tenant_id(current_tenant.id)
    return [BotConfigResponse.from_orm_with_key_check(c) for c in configs]


@router.get("/active", response_model=BotConfigResponse)
async def get_active_config(
    current_tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    """Get the active bot configuration for the authenticated tenant."""
    repo = BotConfigRepository(db)
    config = await repo.get_active_by_tenant_id(current_tenant.id)
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active bot configuration found"
        )
    
    return BotConfigResponse.from_orm_with_key_check(config)


@router.get("/{config_id}", response_model=BotConfigResponse)
async def get_bot_config(
    config_id: UUID,
    current_tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific bot configuration."""
    repo = BotConfigRepository(db)
    config = await repo.get_by_id(config_id)
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot configuration not found"
        )
    
    if config.tenant_id != current_tenant.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    return BotConfigResponse.from_orm_with_key_check(config)


@router.put("/{config_id}", response_model=BotConfigResponse)
async def update_bot_config(
    config_id: UUID,
    config_data: BotConfigUpdate,
    current_tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    """Update a bot configuration."""
    repo = BotConfigRepository(db)
    config = await repo.get_by_id(config_id)
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot configuration not found"
        )
    
    if config.tenant_id != current_tenant.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    update_data = config_data.model_dump(exclude_unset=True)
    
    # Convert trigger_mode enum if present
    if "trigger_mode" in update_data and update_data["trigger_mode"]:
        update_data["trigger_mode"] = TriggerMode(update_data["trigger_mode"].value)
    
    for field, value in update_data.items():
        setattr(config, field, value)
    
    updated = await repo.update(config)
    return BotConfigResponse.from_orm_with_key_check(updated)


@router.delete("/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bot_config(
    config_id: UUID,
    current_tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    """Delete a bot configuration."""
    repo = BotConfigRepository(db)
    config = await repo.get_by_id(config_id)
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot configuration not found"
        )
    
    if config.tenant_id != current_tenant.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    await repo.delete(config_id)
    return None


@router.post("/{config_id}/activate", response_model=BotConfigResponse)
async def activate_bot_config(
    config_id: UUID,
    current_tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    """Activate a bot configuration and deactivate others."""
    repo = BotConfigRepository(db)
    config = await repo.get_by_id(config_id)
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot configuration not found"
        )
    
    if config.tenant_id != current_tenant.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Deactivate all other configs for this tenant
    all_configs = await repo.get_by_tenant_id(current_tenant.id)
    for c in all_configs:
        if c.id != config_id:
            c.is_active = False
            await repo.update(c)
    
    # Activate the target config
    config.is_active = True
    updated = await repo.update(config)
    
    return BotConfigResponse.from_orm_with_key_check(updated)
