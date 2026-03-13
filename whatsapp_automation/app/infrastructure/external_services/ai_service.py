"""
AI Service - Multi-provider chat completion and audio transcription.

Supports:
- Google Gemini (default, cheapest)
- OpenAI GPT (fallback / premium option)
- Whisper audio transcription (OpenAI - used by both providers)
"""

import re
import logging
import httpx
from typing import List, Dict, Optional
from pydantic import BaseModel

from app.core.config import settings

logger = logging.getLogger(__name__)


class ChatMessage(BaseModel):
    """Chat message model."""
    role: str  # 'system', 'user', 'assistant'
    content: str


class AIService:
    """
    Multi-provider AI service.

    Supports Gemini and OpenAI for chat completion.
    Uses OpenAI Whisper for audio transcription (both providers).
    """

    DEFAULT_SYSTEM_PROMPT_TEMPLATE = """Voce e {PERSONA_NAME}, um assistente virtual especializado em {AREA_ATUACAO}.

Tom de voz: {TOM_DE_VOZ}

Instrucoes especificas:
{INSTRUCOES_ESPECIFICAS}

Regras:
- Responda sempre em portugues brasileiro
- Seja conciso e direto
- Mantenha o contexto da conversa
- Se nao souber algo, admita e ofereca alternativas"""

    def __init__(
        self,
        provider: str = "gemini",
        api_key: Optional[str] = None,
        openai_api_key: Optional[str] = None,
    ):
        self.provider = provider.lower()

        if self.provider == "gemini":
            self.api_key = api_key or settings.GOOGLE_API_KEY
            self.openai_api_key = openai_api_key or settings.OPENAI_API_KEY
        else:
            self.api_key = api_key or settings.OPENAI_API_KEY
            self.openai_api_key = self.api_key

        if not self.api_key:
            logger.warning(f"No API key configured for provider: {self.provider}")

        self._gemini_client = None
        self._openai_client = None

        self.max_tokens = 1000
        self.temperature = 0.7

    def _get_gemini_client(self):
        if self._gemini_client is None:
            from google import genai
            self._gemini_client = genai.Client(api_key=self.api_key)
        return self._gemini_client

    def _get_openai_client(self):
        if self._openai_client is None:
            from openai import AsyncOpenAI
            key = self.openai_api_key or self.api_key
            self._openai_client = AsyncOpenAI(api_key=key)
        return self._openai_client

    def inject_template_variables(self, template: str, variables: Dict[str, str]) -> str:
        result = template
        for key, value in variables.items():
            result = result.replace("{" + key + "}", str(value))
        remaining = re.findall(r'\{([A-Z_]+)\}', result)
        for placeholder in remaining:
            result = result.replace("{" + placeholder + "}", "[nao definido]")
            logger.warning(f"Template variable not provided: {placeholder}")
        return result

    def build_system_prompt(
        self,
        persona_name: str,
        area_atuacao: str = "atendimento ao cliente",
        tom_de_voz: str = "profissional e amigavel",
        instrucoes_especificas: str = "Ajude o usuario com suas duvidas.",
        custom_template: Optional[str] = None,
    ) -> str:
        template = custom_template or self.DEFAULT_SYSTEM_PROMPT_TEMPLATE
        variables = {
            "PERSONA_NAME": persona_name,
            "AREA_ATUACAO": area_atuacao,
            "TOM_DE_VOZ": tom_de_voz,
            "INSTRUCOES_ESPECIFICAS": instrucoes_especificas,
        }
        return self.inject_template_variables(template, variables)

    async def chat_completion(
        self,
        messages: List[ChatMessage],
        system_prompt: Optional[str] = None,
        model: Optional[str] = None,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
    ) -> str:
        if not self.api_key:
            raise ValueError(f"API key not configured for provider: {self.provider}")

        if self.provider == "gemini":
            return await self._gemini_chat(messages, system_prompt, model, max_tokens, temperature)
        else:
            return await self._openai_chat(messages, system_prompt, model, max_tokens, temperature)

    async def _gemini_chat(
        self,
        messages: List[ChatMessage],
        system_prompt: Optional[str] = None,
        model: Optional[str] = None,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
    ) -> str:
        from google.genai import types

        client = self._get_gemini_client()
        model_name = model or "gemini-2.5-flash"

        contents = []
        for msg in messages:
            role = "model" if msg.role == "assistant" else "user"
            contents.append(types.Content(role=role, parts=[types.Part(text=msg.content)]))

        config = types.GenerateContentConfig(
            system_instruction=system_prompt if system_prompt else None,
            max_output_tokens=max_tokens or self.max_tokens,
            temperature=temperature or self.temperature,
        )

        try:
            response = await client.aio.models.generate_content(
                model=model_name,
                contents=contents,
                config=config,
            )
            text = response.text
            logger.info(f"Gemini completion successful: {len(text)} chars")
            return text
        except Exception as e:
            logger.error(f"Gemini completion failed: {e}")
            raise

    async def _openai_chat(
        self,
        messages: List[ChatMessage],
        system_prompt: Optional[str] = None,
        model: Optional[str] = None,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
    ) -> str:
        client = self._get_openai_client()
        model_name = model or "gpt-4o-mini"

        api_messages = []
        if system_prompt:
            api_messages.append({"role": "system", "content": system_prompt})
        for msg in messages:
            api_messages.append({"role": msg.role, "content": msg.content})

        try:
            response = await client.chat.completions.create(
                model=model_name,
                messages=api_messages,
                max_tokens=max_tokens or self.max_tokens,
                temperature=temperature or self.temperature,
            )
            content = response.choices[0].message.content
            logger.info(f"OpenAI completion successful: {len(content)} chars")
            return content
        except Exception as e:
            logger.error(f"OpenAI completion failed: {e}")
            raise

    async def transcribe_audio(self, audio_url: str, language: str = "pt") -> str:
        """Transcribe audio using OpenAI Whisper (used by both providers)."""
        key = self.openai_api_key or self.api_key
        if not key:
            raise ValueError("OpenAI API key required for audio transcription")

        client = self._get_openai_client()

        try:
            async with httpx.AsyncClient() as http_client:
                response = await http_client.get(audio_url, timeout=30.0)
                response.raise_for_status()
                audio_data = response.content

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
                file_ext = "ogg"

            transcription = await client.audio.transcriptions.create(
                model="whisper-1",
                file=(f"audio.{file_ext}", audio_data),
                language=language,
            )
            logger.info(f"Transcription successful: {len(transcription.text)} chars")
            return transcription.text

        except httpx.HTTPError as e:
            logger.error(f"Failed to download audio: {e}")
            raise ValueError(f"Could not download audio file: {e}")
        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            raise


# Singleton cache
_ai_service: Optional[AIService] = None


def get_ai_service(
    provider: Optional[str] = None,
    api_key: Optional[str] = None,
    openai_api_key: Optional[str] = None,
) -> AIService:
    """Get or create AI service instance."""
    global _ai_service

    if api_key or provider:
        return AIService(
            provider=provider or settings.AI_PROVIDER,
            api_key=api_key,
            openai_api_key=openai_api_key,
        )

    if _ai_service is None:
        _ai_service = AIService(provider=settings.AI_PROVIDER)

    return _ai_service
