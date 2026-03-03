from typing import Optional, List
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.tenant import Tenant
from app.domain.interfaces.tenant_repository import ITenantRepository
from app.core.security import hash_api_key


class TenantRepository(ITenantRepository):
    """PostgreSQL implementation of Tenant repository."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create(self, tenant: Tenant) -> Tenant:
        self.session.add(tenant)
        await self.session.flush()
        await self.session.refresh(tenant)
        return tenant
    
    async def get_by_id(self, tenant_id: UUID) -> Optional[Tenant]:
        result = await self.session.execute(
            select(Tenant).where(Tenant.id == tenant_id)
        )
        return result.scalar_one_or_none()
    
    async def get_by_api_key(self, api_key: str) -> Optional[Tenant]:
        hashed_key = hash_api_key(api_key)
        result = await self.session.execute(
            select(Tenant).where(Tenant.api_key == hashed_key)
        )
        return result.scalar_one_or_none()
    
    async def get_by_phone(self, phone_number: str) -> Optional[Tenant]:
        result = await self.session.execute(
            select(Tenant).where(Tenant.phone_number == phone_number)
        )
        return result.scalar_one_or_none()
    
    async def get_all(self, skip: int = 0, limit: int = 100) -> List[Tenant]:
        result = await self.session.execute(
            select(Tenant).offset(skip).limit(limit).order_by(Tenant.created_at.desc())
        )
        return list(result.scalars().all())
    
    async def update(self, tenant: Tenant) -> Tenant:
        await self.session.flush()
        await self.session.refresh(tenant)
        return tenant
    
    async def delete(self, tenant_id: UUID) -> bool:
        tenant = await self.get_by_id(tenant_id)
        if tenant:
            await self.session.delete(tenant)
            await self.session.flush()
            return True
        return False
