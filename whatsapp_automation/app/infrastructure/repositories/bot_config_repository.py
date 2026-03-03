from typing import Optional, List
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.bot_config import BotConfig
from app.domain.interfaces.bot_config_repository import IBotConfigRepository
from app.core.security import encrypt_value

_ENC_PREFIX = "enc:"


def _encrypt_key_if_needed(value: Optional[str]) -> Optional[str]:
    """Encrypt an OpenAI API key before persisting, skip if already encrypted."""
    if value and not value.startswith(_ENC_PREFIX):
        return encrypt_value(value)
    return value


class BotConfigRepository(IBotConfigRepository):
    """PostgreSQL implementation of BotConfig repository."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, bot_config: BotConfig) -> BotConfig:
        bot_config.openai_api_key = _encrypt_key_if_needed(bot_config.openai_api_key)
        self.session.add(bot_config)
        await self.session.flush()
        await self.session.refresh(bot_config)
        return bot_config
    
    async def get_by_id(self, config_id: UUID) -> Optional[BotConfig]:
        result = await self.session.execute(
            select(BotConfig).where(BotConfig.id == config_id)
        )
        return result.scalar_one_or_none()
    
    async def get_by_tenant_id(self, tenant_id: UUID) -> List[BotConfig]:
        result = await self.session.execute(
            select(BotConfig)
            .where(BotConfig.tenant_id == tenant_id)
            .order_by(BotConfig.created_at.desc())
        )
        return list(result.scalars().all())
    
    async def get_active_by_tenant_id(self, tenant_id: UUID) -> Optional[BotConfig]:
        result = await self.session.execute(
            select(BotConfig)
            .where(BotConfig.tenant_id == tenant_id, BotConfig.is_active == True)
            .order_by(BotConfig.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()
    
    async def update(self, bot_config: BotConfig) -> BotConfig:
        bot_config.openai_api_key = _encrypt_key_if_needed(bot_config.openai_api_key)
        await self.session.flush()
        await self.session.refresh(bot_config)
        return bot_config
    
    async def delete(self, config_id: UUID) -> bool:
        config = await self.get_by_id(config_id)
        if config:
            await self.session.delete(config)
            await self.session.flush()
            return True
        return False
