from abc import ABC, abstractmethod
from typing import Optional, List
from uuid import UUID

from app.domain.entities.tenant import Tenant


class ITenantRepository(ABC):
    """Abstract interface for Tenant repository."""
    
    @abstractmethod
    async def create(self, tenant: Tenant) -> Tenant:
        """Create a new tenant."""
        pass
    
    @abstractmethod
    async def get_by_id(self, tenant_id: UUID) -> Optional[Tenant]:
        """Get tenant by ID."""
        pass
    
    @abstractmethod
    async def get_by_api_key(self, api_key: str) -> Optional[Tenant]:
        """Get tenant by API key."""
        pass
    
    @abstractmethod
    async def get_by_phone(self, phone_number: str) -> Optional[Tenant]:
        """Get tenant by phone number."""
        pass
    
    @abstractmethod
    async def get_all(self, skip: int = 0, limit: int = 100) -> List[Tenant]:
        """Get all tenants with pagination."""
        pass
    
    @abstractmethod
    async def update(self, tenant: Tenant) -> Tenant:
        """Update an existing tenant."""
        pass
    
    @abstractmethod
    async def delete(self, tenant_id: UUID) -> bool:
        """Delete a tenant by ID."""
        pass
