from abc import ABC, abstractmethod
from typing import Optional, List
from datetime import datetime

from app.domain.entities.message_log import MessageLog


class IMessageLogRepository(ABC):
    """Abstract interface for MessageLog repository (MongoDB)."""
    
    @abstractmethod
    async def create(self, message_log: MessageLog) -> MessageLog:
        """Create a new message log entry."""
        pass
    
    @abstractmethod
    async def get_by_session(self, tenant_id: str, session_id: str) -> List[MessageLog]:
        """Get all messages for a session."""
        pass
    
    @abstractmethod
    async def get_by_phone(self, tenant_id: str, phone: str, limit: int = 50) -> List[MessageLog]:
        """Get recent messages from a phone number."""
        pass
    
    @abstractmethod
    async def get_conversation_history(
        self, tenant_id: str, session_id: str, limit: int = 10
    ) -> List[MessageLog]:
        """Get recent conversation history for context."""
        pass
    
    @abstractmethod
    async def update_response(
        self, tenant_id: str, session_id: str, ai_response: str, response_sent_at: datetime
    ) -> bool:
        """Update message log with AI response."""
        pass
    
    @abstractmethod
    async def get_logs_by_date_range(
        self, tenant_id: str, start_date: datetime, end_date: datetime
    ) -> List[MessageLog]:
        """Get message logs within a date range."""
        pass
