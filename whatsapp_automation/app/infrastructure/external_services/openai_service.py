"""
OpenAI Service - Chat Completion and Audio Transcription.

Handles:
- GPT-4 chat completion with dynamic system prompts
- Whisper audio transcription
- Template variable injection for prompts
"""

import re
import logging
import httpx
from typing import List, Dict, Optional, Any
from openai import AsyncOpenAI
from pydantic import BaseModel

from app.core.config import settings

logger = logging.getLogger(__name__)


class ChatMessage(BaseModel):
    """Chat message model for OpenAI."""
    role: str  # 'system', 'user', 'assistant'
    content: str


class OpenAIService:
    """
    Service for interacting with OpenAI APIs.
    
    Supports:
    - Chat completion with GPT-4
    - Audio transcription with Whisper
    - Dynamic system prompt template injection
    """
    
    # Default system prompt template
    DEFAULT_SYSTEM_PROMPT_TEMPLATE = """Você é {PERSONA_NAME}, um assistente virtual especializado em {AREA_ATUACAO}.

Tom de voz: {TOM_DE_VOZ}

Instruções específicas:
{INSTRUCOES_ESPECIFICAS}

Regras:
- Responda sempre em português brasileiro
- Seja conciso e direto
- Mantenha o contexto da conversa
- Se não souber algo, admita e ofereça alternativas"""
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize OpenAI service.
        
        Args:
            api_key: OpenAI API key. Falls back to settings if not provided.
        """
        self.api_key = api_key or settings.OPENAI_API_KEY
        if not self.api_key:
            logger.warning("No OpenAI API key configured")
        
        self.client = AsyncOpenAI(api_key=self.api_key) if self.api_key else None
        
        # Default model configurations
        self.chat_model = "gpt-4-turbo-preview"  # or "gpt-4" or "gpt-3.5-turbo"
        self.whisper_model = "whisper-1"
        self.max_tokens = 1000
        self.temperature = 0.7
    
    def inject_template_variables(
        self, 
        template: str, 
        variables: Dict[str, str]
    ) -> str:
        """
        Inject variables into a system prompt template.
        
        Args:
            template: Template string with {VARIABLE_NAME} placeholders
            variables: Dictionary of variable names to values
            
        Returns:
            Processed template with variables replaced
        """
        result = template
        
        for key, value in variables.items():
            placeholder = "{" + key + "}"
            result = result.replace(placeholder, str(value))
        
        # Check for any remaining placeholders and set defaults
        remaining = re.findall(r'\{([A-Z_]+)\}', result)
        for placeholder in remaining:
            result = result.replace("{" + placeholder + "}", "[não definido]")
            logger.warning(f"Template variable not provided: {placeholder}")
        
        return result
    
    def build_system_prompt(
        self,
        persona_name: str,
        area_atuacao: str = "atendimento ao cliente",
        tom_de_voz: str = "profissional e amigável",
        instrucoes_especificas: str = "Ajude o usuário com suas dúvidas.",
        custom_template: Optional[str] = None
    ) -> str:
        """
        Build a complete system prompt with injected variables.
        
        Args:
            persona_name: Name of the AI persona
            area_atuacao: Area of expertise
            tom_de_voz: Tone of voice
            instrucoes_especificas: Specific instructions
            custom_template: Optional custom template (uses default if None)
            
        Returns:
            Complete system prompt
        """
        template = custom_template or self.DEFAULT_SYSTEM_PROMPT_TEMPLATE
        
        variables = {
            "PERSONA_NAME": persona_name,
            "AREA_ATUACAO": area_atuacao,
            "TOM_DE_VOZ": tom_de_voz,
            "INSTRUCOES_ESPECIFICAS": instrucoes_especificas
        }
        
        return self.inject_template_variables(template, variables)
    
    async def chat_completion(
        self,
        messages: List[ChatMessage],
        system_prompt: Optional[str] = None,
        model: Optional[str] = None,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None
    ) -> str:
        """
        Generate a chat completion response.
        
        Args:
            messages: List of conversation messages
            system_prompt: System prompt to prepend
            model: Override default model
            max_tokens: Override default max tokens
            temperature: Override default temperature
            
        Returns:
            AI-generated response text
            
        Raises:
            ValueError: If no API key is configured
            Exception: If API call fails
        """
        if not self.client:
            raise ValueError("OpenAI API key not configured")
        
        # Build messages list
        api_messages = []
        
        if system_prompt:
            api_messages.append({
                "role": "system",
                "content": system_prompt
            })
        
        for msg in messages:
            api_messages.append({
                "role": msg.role,
                "content": msg.content
            })
        
        try:
            response = await self.client.chat.completions.create(
                model=model or self.chat_model,
                messages=api_messages,
                max_tokens=max_tokens or self.max_tokens,
                temperature=temperature or self.temperature
            )
            
            content = response.choices[0].message.content
            logger.info(f"Chat completion successful: {len(content)} chars")
            return content
            
        except Exception as e:
            logger.error(f"Chat completion failed: {e}")
            raise
    
    async def transcribe_audio(
        self,
        audio_url: str,
        language: str = "pt"
    ) -> str:
        """
        Transcribe audio using Whisper API.
        
        Args:
            audio_url: URL of the audio file to transcribe
            language: Language code (default: Portuguese)
            
        Returns:
            Transcribed text
            
        Raises:
            ValueError: If no API key is configured
            Exception: If transcription fails
        """
        if not self.client:
            raise ValueError("OpenAI API key not configured")
        
        try:
            # Download audio file
            logger.info(f"Downloading audio from: {audio_url}")
            async with httpx.AsyncClient() as http_client:
                response = await http_client.get(audio_url, timeout=30.0)
                response.raise_for_status()
                audio_data = response.content
            
            # Determine file extension from URL or content type
            content_type = response.headers.get("content-type", "")
            if "ogg" in content_type or audio_url.endswith(".ogg"):
                file_ext = "ogg"
            elif "mp3" in content_type or audio_url.endswith(".mp3"):
                file_ext = "mp3"
            elif "wav" in content_type or audio_url.endswith(".wav"):
                file_ext = "wav"
            elif "m4a" in content_type or audio_url.endswith(".m4a"):
                file_ext = "m4a"
            else:
                file_ext = "ogg"  # Default for WhatsApp voice messages
            
            # Create file-like object for API
            file_name = f"audio.{file_ext}"
            
            # Transcribe using Whisper
            transcription = await self.client.audio.transcriptions.create(
                model=self.whisper_model,
                file=(file_name, audio_data),
                language=language
            )
            
            text = transcription.text
            logger.info(f"Transcription successful: {len(text)} chars")
            return text
            
        except httpx.HTTPError as e:
            logger.error(f"Failed to download audio: {e}")
            raise ValueError(f"Could not download audio file: {e}")
        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            raise
    
    async def transcribe_audio_bytes(
        self,
        audio_data: bytes,
        file_extension: str = "ogg",
        language: str = "pt"
    ) -> str:
        """
        Transcribe audio from bytes using Whisper API.
        
        Args:
            audio_data: Audio file content as bytes
            file_extension: File extension (ogg, mp3, wav, m4a)
            language: Language code
            
        Returns:
            Transcribed text
        """
        if not self.client:
            raise ValueError("OpenAI API key not configured")
        
        try:
            file_name = f"audio.{file_extension}"
            
            transcription = await self.client.audio.transcriptions.create(
                model=self.whisper_model,
                file=(file_name, audio_data),
                language=language
            )
            
            return transcription.text
            
        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            raise


# Singleton instance for convenience
_openai_service: Optional[OpenAIService] = None


def get_openai_service(api_key: Optional[str] = None) -> OpenAIService:
    """
    Get or create OpenAI service instance.
    
    Args:
        api_key: Optional API key override
        
    Returns:
        OpenAIService instance
    """
    global _openai_service
    
    if api_key:
        # Return new instance with custom key
        return OpenAIService(api_key=api_key)
    
    if _openai_service is None:
        _openai_service = OpenAIService()
    
    return _openai_service
