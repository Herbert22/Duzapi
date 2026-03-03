"""
Message Processor Service - Core message handling logic.

Responsibilities:
- Check if bot should respond (trigger mode)
- Retrieve conversation history
- Process text or audio (transcribe if audio)
- Build context and send to OpenAI
- Return response
"""

import logging
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID

from app.core.database import get_mongodb, AsyncSessionLocal
from app.infrastructure.repositories.message_log_repository import MessageLogRepository
from app.infrastructure.repositories.bot_config_repository import BotConfigRepository
from app.infrastructure.external_services.openai_service import (
    OpenAIService,
    ChatMessage,
    get_openai_service
)
from app.domain.entities.message_log import MessageLog, MessageType
from app.domain.entities.bot_config import BotConfig, TriggerMode
from app.core.config import settings

logger = logging.getLogger(__name__)


class MessageProcessor:
    """
    Service for processing incoming messages and generating AI responses.
    
    Flow:
    1. Check trigger conditions
    2. Retrieve conversation history
    3. Process content (transcribe if audio)
    4. Build prompt with context
    5. Generate AI response
    6. Log and return response
    """
    
    # Default history limit
    HISTORY_LIMIT = 10
    
    def __init__(
        self,
        bot_config: BotConfig,
        openai_service: OpenAIService,
        message_repo: MessageLogRepository
    ):
        """
        Initialize message processor.
        
        Args:
            bot_config: Bot configuration for the tenant
            openai_service: OpenAI service instance
            message_repo: Message log repository
        """
        self.bot_config = bot_config
        self.openai_service = openai_service
        self.message_repo = message_repo
    
    @classmethod
    async def create(
        cls,
        tenant_id: str,
        bot_config_id: str
    ) -> "MessageProcessor":
        """
        Factory method to create a MessageProcessor instance.
        
        Args:
            tenant_id: Tenant UUID
            bot_config_id: Bot config UUID
            
        Returns:
            Configured MessageProcessor instance
        """
        # Get MongoDB connection
        mongodb = get_mongodb()
        message_repo = MessageLogRepository(mongodb)
        
        # Get bot config from PostgreSQL
        async with AsyncSessionLocal() as session:
            config_repo = BotConfigRepository(session)
            bot_config = await config_repo.get_by_id(UUID(bot_config_id))
            
            if not bot_config:
                raise ValueError(f"Bot config not found: {bot_config_id}")
        
        # Create OpenAI service with tenant's API key or default (decrypt if encrypted)
        from app.core.security import decrypt_value
        api_key = decrypt_value(bot_config.openai_api_key) if bot_config.openai_api_key else settings.OPENAI_API_KEY
        openai_service = get_openai_service(api_key=api_key)
        
        return cls(
            bot_config=bot_config,
            openai_service=openai_service,
            message_repo=message_repo
        )
    
    def should_respond(self, message_content: str) -> bool:
        """
        Check if bot should respond based on trigger mode.
        
        Args:
            message_content: The message text content
            
        Returns:
            True if bot should respond, False otherwise
        """
        return self.bot_config.should_respond(message_content)
    
    async def get_conversation_history(
        self,
        tenant_id: str,
        session_id: str,
        limit: int = None
    ) -> List[MessageLog]:
        """
        Retrieve recent conversation history.
        
        Args:
            tenant_id: Tenant UUID
            session_id: Conversation session ID
            limit: Number of messages to retrieve
            
        Returns:
            List of recent messages in chronological order
        """
        limit = limit or self.HISTORY_LIMIT
        return await self.message_repo.get_conversation_history(
            tenant_id=tenant_id,
            session_id=session_id,
            limit=limit
        )
    
    async def transcribe_audio(self, audio_url: str) -> str:
        """
        Transcribe audio content using Whisper.
        
        Args:
            audio_url: URL of the audio file
            
        Returns:
            Transcribed text
        """
        try:
            transcription = await self.openai_service.transcribe_audio(
                audio_url=audio_url,
                language="pt"
            )
            return transcription
        except Exception as e:
            logger.error(f"Audio transcription failed: {e}")
            return "[Áudio não pôde ser transcrito]"
    
    def build_conversation_context(
        self,
        history: List[MessageLog],
        current_content: str
    ) -> List[ChatMessage]:
        """
        Build conversation context from history for OpenAI.
        
        Args:
            history: List of previous messages
            current_content: Current message content
            
        Returns:
            List of ChatMessage objects for the API
        """
        messages = []
        
        # Add history
        for msg in history:
            if msg.is_from_me:
                # Bot's previous response
                if msg.ai_response:
                    messages.append(ChatMessage(
                        role="assistant",
                        content=msg.ai_response
                    ))
            else:
                # User's message
                content = msg.transcription or msg.content
                messages.append(ChatMessage(
                    role="user",
                    content=content
                ))
        
        # Add current message
        messages.append(ChatMessage(
            role="user",
            content=current_content
        ))
        
        return messages
    
    async def generate_response(
        self,
        messages: List[ChatMessage]
    ) -> str:
        """
        Generate AI response using OpenAI.
        
        Args:
            messages: Conversation context
            
        Returns:
            AI-generated response
        """
        # Use the bot's system prompt
        system_prompt = self.bot_config.system_prompt
        
        try:
            response = await self.openai_service.chat_completion(
                messages=messages,
                system_prompt=system_prompt
            )
            return response
        except Exception as e:
            logger.error(f"Failed to generate AI response: {e}")
            return "Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente."
    
    async def process_message(
        self,
        session_id: str,
        sender_phone: str,
        message_type: str,
        content: str
    ) -> Dict[str, Any]:
        """
        Process an incoming message and generate a response.
        
        Full processing flow:
        1. Check trigger conditions
        2. Transcribe if audio
        3. Get conversation history
        4. Build context
        5. Generate AI response
        6. Update message log
        7. Return result
        
        Args:
            session_id: Conversation session ID
            sender_phone: Sender's phone number
            message_type: Type of message (text, audio, etc)
            content: Message content or media URL
            
        Returns:
            Dictionary with processing result
        """
        tenant_id = str(self.bot_config.tenant_id)
        result = {
            "success": False,
            "response": None,
            "transcription": None,
            "error": None
        }
        
        try:
            # Process content based on message type
            processed_content = content
            
            if message_type == "audio":
                # Transcribe audio
                logger.info(f"Transcribing audio for session: {session_id}")
                transcription = await self.transcribe_audio(content)
                processed_content = transcription
                result["transcription"] = transcription

                # Persist the transcription to MongoDB
                await self.message_repo.update_transcription(
                    tenant_id=tenant_id,
                    session_id=session_id,
                    transcription=transcription,
                )
            
            # Check if should respond
            if not self.should_respond(processed_content):
                logger.info(f"Message filtered by trigger mode: {session_id}")
                result["error"] = "Message did not match trigger criteria"
                return result
            
            # Get conversation history
            history = await self.get_conversation_history(
                tenant_id=tenant_id,
                session_id=session_id
            )
            
            # Build context
            messages = self.build_conversation_context(
                history=history,
                current_content=processed_content
            )
            
            # Generate response
            ai_response = await self.generate_response(messages)
            
            # Update message log with response
            await self.message_repo.update_response(
                tenant_id=tenant_id,
                session_id=session_id,
                ai_response=ai_response,
                response_sent_at=datetime.utcnow()
            )
            
            result["success"] = True
            result["response"] = ai_response
            
            logger.info(f"Message processed successfully: {session_id}")
            return result
            
        except Exception as e:
            logger.error(f"Message processing failed: {e}")
            result["error"] = str(e)
            return result
    
    async def process_and_get_response(
        self,
        tenant_id: str,
        session_id: str,
        message_type: str,
        content: str
    ) -> Optional[str]:
        """
        Simplified method to process message and return response.
        
        Args:
            tenant_id: Tenant UUID
            session_id: Session ID
            message_type: Message type
            content: Message content
            
        Returns:
            AI response or None if processing failed
        """
        result = await self.process_message(
            session_id=session_id,
            sender_phone="",  # Not needed for response only
            message_type=message_type,
            content=content
        )
        
        return result.get("response")
