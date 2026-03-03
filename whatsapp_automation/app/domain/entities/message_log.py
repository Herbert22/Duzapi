from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from enum import Enum


class MessageType(str, Enum):
    """Type of message received."""
    TEXT = "text"
    AUDIO = "audio"
    IMAGE = "image"
    VIDEO = "video"
    DOCUMENT = "document"
    STICKER = "sticker"
    LOCATION = "location"
    CONTACT = "contact"


class MessageLog(BaseModel):
    """Message log entity - stored in MongoDB for conversation tracking."""
    
    tenant_id: str = Field(..., description="UUID of the tenant")
    session_id: str = Field(..., description="Conversation session identifier")
    sender_phone: str = Field(..., description="Phone number of the sender")
    message_type: MessageType = Field(..., description="Type of message")
    content: str = Field(..., description="Original message content or media URL")
    transcription: Optional[str] = Field(None, description="Audio transcription (Whisper)")
    ai_response: Optional[str] = Field(None, description="AI-generated response")
    processed_at: datetime = Field(default_factory=datetime.utcnow, description="When message was processed")
    response_sent_at: Optional[datetime] = Field(None, description="When response was sent")
    
    # Additional metadata
    message_id: Optional[str] = Field(None, description="WhatsApp message ID")
    is_from_me: bool = Field(default=False, description="Whether message is from bot")
    error: Optional[str] = Field(None, description="Error message if processing failed")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
    
    def to_mongo_dict(self) -> dict:
        """Convert to dictionary for MongoDB insertion."""
        import uuid
        data = self.model_dump()
        # Use a proper UUID for _id to avoid timestamp collision duplicates
        data["_id"] = str(uuid.uuid4())
        return data
