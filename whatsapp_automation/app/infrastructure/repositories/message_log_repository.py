from typing import List, Optional
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.domain.entities.message_log import MessageLog
from app.domain.interfaces.message_log_repository import IMessageLogRepository


class MessageLogRepository(IMessageLogRepository):
    """MongoDB implementation of MessageLog repository."""

    COLLECTION_NAME = "message_logs"

    def __init__(self, database: AsyncIOMotorDatabase):
        self.database = database
        self.collection = database[self.COLLECTION_NAME]

    async def create(self, message_log: MessageLog) -> MessageLog:
        doc = message_log.to_mongo_dict()
        await self.collection.insert_one(doc)
        return message_log

    async def get_by_session(self, tenant_id: str, session_id: str) -> List[MessageLog]:
        cursor = self.collection.find(
            {"tenant_id": tenant_id, "session_id": session_id}
        ).sort("processed_at", 1)

        logs = []
        async for doc in cursor:
            doc.pop("_id", None)
            logs.append(MessageLog(**doc))
        return logs

    async def get_by_phone(self, tenant_id: str, phone: str, limit: int = 50) -> List[MessageLog]:
        cursor = self.collection.find(
            {"tenant_id": tenant_id, "sender_phone": phone}
        ).sort("processed_at", -1).limit(limit)

        logs = []
        async for doc in cursor:
            doc.pop("_id", None)
            logs.append(MessageLog(**doc))
        return logs

    async def get_conversation_history(
        self, tenant_id: str, session_id: str, limit: int = 10
    ) -> List[MessageLog]:
        cursor = self.collection.find(
            {"tenant_id": tenant_id, "session_id": session_id}
        ).sort("processed_at", -1).limit(limit)

        logs = []
        async for doc in cursor:
            doc.pop("_id", None)
            logs.append(MessageLog(**doc))
        return list(reversed(logs))  # Return in chronological order

    async def update_response(
        self,
        tenant_id: str,
        session_id: str,
        ai_response: str,
        response_sent_at: datetime,
    ) -> bool:
        """Update the AI response on the most recent unanswered message in a session."""
        result = await self.collection.update_one(
            {
                "tenant_id": tenant_id,
                "session_id": session_id,
                "is_from_me": False,
                "ai_response": None,
            },
            {
                "$set": {
                    "ai_response": ai_response,
                    "response_sent_at": response_sent_at,
                }
            },
            upsert=False,
        )
        return result.modified_count > 0

    async def update_transcription(
        self,
        tenant_id: str,
        session_id: str,
        transcription: str,
    ) -> bool:
        """Persist the Whisper transcription on the most recent audio message."""
        result = await self.collection.update_one(
            {
                "tenant_id": tenant_id,
                "session_id": session_id,
                "message_type": "audio",
                "transcription": None,
            },
            {"$set": {"transcription": transcription}},
            upsert=False,
        )
        return result.modified_count > 0

    async def exists_by_external_id(self, message_id: str) -> bool:
        """Return True if a document with the given WhatsApp message_id exists."""
        count = await self.collection.count_documents({"message_id": message_id}, limit=1)
        return count > 0

    async def get_logs_by_date_range(
        self, tenant_id: str, start_date: datetime, end_date: datetime
    ) -> List[MessageLog]:
        cursor = self.collection.find(
            {
                "tenant_id": tenant_id,
                "processed_at": {"$gte": start_date, "$lte": end_date},
            }
        ).sort("processed_at", 1)

        logs = []
        async for doc in cursor:
            doc.pop("_id", None)
            logs.append(MessageLog(**doc))
        return logs
