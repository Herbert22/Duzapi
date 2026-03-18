from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, List
from datetime import datetime
from uuid import UUID
from enum import Enum


class AIProviderEnum(str, Enum):
    """AI provider options."""
    GEMINI = "gemini"
    OPENAI = "openai"


class TriggerModeEnum(str, Enum):
    """Trigger mode options."""
    ALL = "all"
    KEYWORDS = "keywords"


class BotConfigBase(BaseModel):
    """Base schema for BotConfig."""
    persona_name: str = Field(..., min_length=1, max_length=100, description="Name of the AI persona")
    system_prompt: str = Field(..., min_length=10, description="System prompt defining persona behavior")
    response_delay_min: int = Field(default=1, ge=0, le=60, description="Minimum response delay (seconds)")
    response_delay_max: int = Field(default=5, ge=0, le=120, description="Maximum response delay (seconds)")
    trigger_mode: TriggerModeEnum = Field(default=TriggerModeEnum.ALL, description="When to trigger responses")
    trigger_keywords: List[str] = Field(default=[], description="Keywords to trigger response (if mode=keywords)")
    ai_provider: AIProviderEnum = Field(default=AIProviderEnum.GEMINI, description="AI provider: gemini or openai")
    initial_message: Optional[str] = Field(None, max_length=2000, description="Mensagem inicial enviada no primeiro contato")
    enable_audio_response: bool = Field(default=False, description="Habilitar resposta por áudio")
    position: int = Field(default=0, ge=0, description="Posição para ordenação drag-and-drop")

    @model_validator(mode="after")
    def validate_delays(self):
        if self.response_delay_min > self.response_delay_max:
            raise ValueError("response_delay_min must be <= response_delay_max")
        return self
    
    @model_validator(mode="after")
    def validate_keywords(self):
        if self.trigger_mode == TriggerModeEnum.KEYWORDS and not self.trigger_keywords:
            raise ValueError("trigger_keywords required when trigger_mode is 'keywords'")
        return self


class BotConfigCreate(BotConfigBase):
    """Schema for creating a new bot config."""
    tenant_id: UUID = Field(..., description="ID of the tenant")
    openai_api_key: Optional[str] = Field(None, description="API key for AI provider (OpenAI or Gemini)")
    is_active: bool = Field(default=True)


class BotConfigUpdate(BaseModel):
    """Schema for updating a bot config."""
    tenant_id: Optional[UUID] = None
    persona_name: Optional[str] = Field(None, min_length=1, max_length=100)
    system_prompt: Optional[str] = Field(None, min_length=10)
    response_delay_min: Optional[int] = Field(None, ge=0, le=60)
    response_delay_max: Optional[int] = Field(None, ge=0, le=120)
    trigger_mode: Optional[TriggerModeEnum] = None
    trigger_keywords: Optional[List[str]] = None
    ai_provider: Optional[AIProviderEnum] = None
    openai_api_key: Optional[str] = None
    is_active: Optional[bool] = None
    initial_message: Optional[str] = Field(None, max_length=2000)
    enable_audio_response: Optional[bool] = None
    position: Optional[int] = Field(None, ge=0)


class BotConfigResponse(BotConfigBase):
    """Schema for bot config response."""
    id: UUID
    tenant_id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime
    has_openai_key: bool = Field(description="Whether tenant has custom API key")

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_with_key_check(cls, obj):
        """Create response from ORM object, checking for API key presence."""
        data = {
            "id": obj.id,
            "tenant_id": obj.tenant_id,
            "persona_name": obj.persona_name,
            "system_prompt": obj.system_prompt,
            "response_delay_min": obj.response_delay_min,
            "response_delay_max": obj.response_delay_max,
            "trigger_mode": obj.trigger_mode,
            "trigger_keywords": obj.trigger_keywords or [],
            "ai_provider": getattr(obj, "ai_provider", None) or "gemini",
            "initial_message": getattr(obj, "initial_message", None),
            "enable_audio_response": getattr(obj, "enable_audio_response", False),
            "position": getattr(obj, "position", 0),
            "is_active": obj.is_active,
            "created_at": obj.created_at,
            "updated_at": obj.updated_at,
            "has_openai_key": bool(obj.openai_api_key),
        }
        return cls(**data)
