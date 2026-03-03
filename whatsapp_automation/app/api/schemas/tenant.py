from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime
from uuid import UUID
import re


class TenantBase(BaseModel):
    """Base schema for Tenant."""
    name: str = Field(..., min_length=1, max_length=255, description="Tenant name")
    phone_number: str = Field(..., description="WhatsApp phone number with country code")
    
    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        # Remove any non-digit characters except +
        cleaned = re.sub(r"[^\d+]", "", v)
        if not re.match(r"^\+?\d{10,15}$", cleaned):
            raise ValueError("Invalid phone number format. Use international format (e.g., +5511999999999)")
        return cleaned


class TenantCreate(TenantBase):
    """Schema for creating a new tenant."""
    pass


class TenantUpdate(BaseModel):
    """Schema for updating a tenant."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    phone_number: Optional[str] = None
    is_active: Optional[bool] = None
    
    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        cleaned = re.sub(r"[^\d+]", "", v)
        if not re.match(r"^\+?\d{10,15}$", cleaned):
            raise ValueError("Invalid phone number format")
        return cleaned


class TenantResponse(TenantBase):
    """Schema for tenant response."""
    id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class TenantWithApiKey(TenantResponse):
    """Schema for tenant response including API key (only on creation)."""
    api_key: str = Field(..., description="API key - store securely, shown only once")
