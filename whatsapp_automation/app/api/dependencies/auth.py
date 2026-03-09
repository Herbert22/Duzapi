from fastapi import Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.core.database import get_db
from app.core.security import hash_api_key
from app.domain.entities.tenant import Tenant
from app.infrastructure.repositories.tenant_repository import TenantRepository


async def get_current_tenant(
    x_api_key: str = Header(..., description="Tenant API Key"),
    db: AsyncSession = Depends(get_db)
) -> Tenant:
    """Dependency to get and validate the current tenant from API key."""
    repo = TenantRepository(db)
    tenant = await repo.get_by_api_key(x_api_key)
    
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Chave de API inválida"
        )
    
    if not tenant.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Conta do tenant está desativada"
        )
    
    return tenant


async def get_optional_tenant(
    x_api_key: Optional[str] = Header(None, description="Optional Tenant API Key"),
    db: AsyncSession = Depends(get_db)
) -> Optional[Tenant]:
    """Dependency to optionally get tenant from API key."""
    if not x_api_key:
        return None
    
    repo = TenantRepository(db)
    tenant = await repo.get_by_api_key(x_api_key)
    
    if tenant and tenant.is_active:
        return tenant
    return None
