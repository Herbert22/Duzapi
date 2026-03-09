from sqlalchemy import Column, String, Boolean, Integer, DateTime, ForeignKey, Text, func, Enum
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
import uuid
import enum

from app.core.database import Base


class TriggerMode(str, enum.Enum):
    """Trigger mode for bot activation."""
    ALL = "all"  # Respond to all messages
    KEYWORDS = "keywords"  # Respond only to messages containing trigger keywords


class BotConfig(Base):
    """Bot configuration entity - persona and behavior settings per tenant."""
    
    __tablename__ = "bot_configs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Persona settings
    persona_name = Column(String(100), nullable=False)
    system_prompt = Column(Text, nullable=False)
    
    # Response delay settings (for humanization)
    response_delay_min = Column(Integer, default=1, nullable=False)  # seconds
    response_delay_max = Column(Integer, default=5, nullable=False)  # seconds
    
    # Trigger settings
    trigger_mode = Column(Enum(TriggerMode), default=TriggerMode.ALL, nullable=False)
    trigger_keywords = Column(ARRAY(String), default=[], nullable=False)
    
    # AI provider: "gemini" or "openai"
    ai_provider = Column(String(20), default="gemini", nullable=False, server_default="gemini")

    # API key for AI provider (tenant-specific, encrypted in production)
    openai_api_key = Column(String(255), nullable=True)

    # Initial greeting message (sent on first contact)
    initial_message = Column(Text, nullable=True)

    # Audio response settings
    enable_audio_response = Column(Boolean, default=False, nullable=False, server_default="false")

    # Position for drag-and-drop ordering
    position = Column(Integer, default=0, nullable=False, server_default="0")

    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="bot_configs")
    
    def __repr__(self):
        return f"<BotConfig(id={self.id}, persona='{self.persona_name}', tenant_id={self.tenant_id})>"
    
    def should_respond(self, message_content: str) -> bool:
        """Check if bot should respond to the given message based on trigger mode."""
        if not self.is_active:
            return False
        
        if self.trigger_mode == TriggerMode.ALL:
            return True
        
        if self.trigger_mode == TriggerMode.KEYWORDS:
            message_lower = message_content.lower()
            return any(keyword.lower() in message_lower for keyword in self.trigger_keywords)
        
        return False
