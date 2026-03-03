from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class MessageTypeEnum(str, Enum):
    """Message type options."""
    TEXT = "text"
    AUDIO = "audio"
    IMAGE = "image"
    VIDEO = "video"
    DOCUMENT = "document"
    STICKER = "sticker"
    LOCATION = "location"
    CONTACT = "contact"


class MessageLogCreate(BaseModel):
    """Schema for creating a message log."""
    tenant_id: str = Field(..., description="Tenant UUID as string")
    session_id: str = Field(..., description="Conversation session ID")
    sender_phone: str = Field(..., description="Sender phone number")
    message_type: MessageTypeEnum = Field(..., description="Type of message")
    content: str = Field(..., description="Message content or media URL")
    message_id: Optional[str] = Field(None, description="WhatsApp message ID")
    is_from_me: bool = Field(default=False)


class MessageLogResponse(BaseModel):
    """Schema for message log response."""
    tenant_id: str
    session_id: str
    sender_phone: str
    message_type: MessageTypeEnum
    content: str
    transcription: Optional[str] = None
    ai_response: Optional[str] = None
    processed_at: datetime
    response_sent_at: Optional[datetime] = None
    message_id: Optional[str] = None
    is_from_me: bool
    error: Optional[str] = None
    
    class Config:
        from_attributes = True


class ConversationHistory(BaseModel):
    """Schema for conversation history."""
    tenant_id: str
    session_id: str
    messages: List[MessageLogResponse]
    total_count: int


class MessageStats(BaseModel):
    """Schema for message statistics."""
    tenant_id: str
    total_messages: int
    text_messages: int
    audio_messages: int
    other_messages: int
    avg_response_time_seconds: Optional[float] = None
    date_range_start: datetime
    date_range_end: datetime
