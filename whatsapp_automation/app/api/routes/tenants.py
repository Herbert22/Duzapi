"""Tenant API routes - Full CRUD operations."""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID

from app.core.database import get_db
from app.core.security import generate_api_key, hash_api_key
from app.domain.entities.tenant import Tenant
from app.infrastructure.repositories.tenant_repository import TenantRepository
from app.api.schemas.tenant import (
    TenantCreate,
    TenantUpdate,
    TenantResponse,
    TenantWithApiKey,
)

router = APIRouter()


@router.post("/", response_model=TenantWithApiKey, status_code=status.HTTP_201_CREATED)
async def create_tenant(
    tenant_data: TenantCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new tenant. Returns API key only once."""
    repo = TenantRepository(db)
    
    # Check if phone already exists
    existing = await repo.get_by_phone(tenant_data.phone_number)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Phone number already registered"
        )
    
    # Generate API key
    api_key = generate_api_key()
    hashed_key = hash_api_key(api_key)
    
    tenant = Tenant(
        name=tenant_data.name,
        phone_number=tenant_data.phone_number,
        api_key=hashed_key,
        is_active=True
    )
    
    created = await repo.create(tenant)
    
    return TenantWithApiKey(
        id=created.id,
        name=created.name,
        phone_number=created.phone_number,
        is_active=created.is_active,
        created_at=created.created_at,
        updated_at=created.updated_at,
        api_key=api_key  # Return plain API key (only shown once)
    )


@router.get("/", response_model=List[TenantResponse])
async def list_tenants(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db)
):
    """List all tenants with pagination."""
    repo = TenantRepository(db)
    tenants = await repo.get_all(skip=skip, limit=limit)
    return [TenantResponse.model_validate(t) for t in tenants]


@router.get("/{tenant_id}", response_model=TenantResponse)
async def get_tenant(
    tenant_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get a tenant by ID."""
    repo = TenantRepository(db)
    tenant = await repo.get_by_id(tenant_id)
    
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    return TenantResponse.model_validate(tenant)


@router.put("/{tenant_id}", response_model=TenantResponse)
async def update_tenant(
    tenant_id: UUID,
    tenant_data: TenantUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update a tenant."""
    repo = TenantRepository(db)
    tenant = await repo.get_by_id(tenant_id)
    
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    # Check if new phone is already in use
    if tenant_data.phone_number and tenant_data.phone_number != tenant.phone_number:
        existing = await repo.get_by_phone(tenant_data.phone_number)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Phone number already in use"
            )
    
    # Update fields
    update_data = tenant_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(tenant, field, value)
    
    updated = await repo.update(tenant)
    return TenantResponse.model_validate(updated)


@router.delete("/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tenant(
    tenant_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Delete a tenant and all associated data."""
    repo = TenantRepository(db)
    deleted = await repo.delete(tenant_id)
    
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    return None


@router.post("/{tenant_id}/regenerate-api-key", response_model=TenantWithApiKey)
async def regenerate_api_key(
    tenant_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Regenerate API key for a tenant."""
    repo = TenantRepository(db)
    tenant = await repo.get_by_id(tenant_id)
    
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    new_api_key = generate_api_key()
    tenant.api_key = hash_api_key(new_api_key)
    
    updated = await repo.update(tenant)
    
    return TenantWithApiKey(
        id=updated.id,
        name=updated.name,
        phone_number=updated.phone_number,
        is_active=updated.is_active,
        created_at=updated.created_at,
        updated_at=updated.updated_at,
        api_key=new_api_key
    )
