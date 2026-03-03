from abc import ABC, abstractmethod
from typing import Optional, List
from uuid import UUID

from app.domain.entities.bot_config import BotConfig


class IBotConfigRepository(ABC):
    """Abstract interface for BotConfig repository."""
    
    @abstractmethod
    async def create(self, bot_config: BotConfig) -> BotConfig:
        """Create a new bot configuration."""
        pass
    
    @abstractmethod
    async def get_by_id(self, config_id: UUID) -> Optional[BotConfig]:
        """Get bot config by ID."""
        pass
    
    @abstractmethod
    async def get_by_tenant_id(self, tenant_id: UUID) -> List[BotConfig]:
        """Get all bot configs for a tenant."""
        pass
    
    @abstractmethod
    async def get_active_by_tenant_id(self, tenant_id: UUID) -> Optional[BotConfig]:
        """Get the active bot config for a tenant."""
        pass
    
    @abstractmethod
    async def update(self, bot_config: BotConfig) -> BotConfig:
        """Update an existing bot configuration."""
        pass
    
    @abstractmethod
    async def delete(self, config_id: UUID) -> bool:
        """Delete a bot config by ID."""
        pass
