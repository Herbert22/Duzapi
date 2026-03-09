"""Admin Upload API routes — file upload for funnel media.

Protected by BRIDGE_AUTH_TOKEN (used by the Next.js admin panel).
"""

import os
import uuid
import logging
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Header, UploadFile, File, status
from fastapi.responses import FileResponse
from typing import Optional

from app.core.config import get_settings

router = APIRouter()
settings = get_settings()
logger = logging.getLogger(__name__)

UPLOAD_DIR = Path(settings.BASE_DIR) / "uploads"
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB

ALLOWED_EXTENSIONS = {
    # Images
    ".jpg", ".jpeg", ".png", ".gif", ".webp",
    # Audio
    ".mp3", ".ogg", ".opus", ".wav", ".m4a",
    # Video
    ".mp4", ".avi", ".mov", ".webm",
    # Documents
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt",
}

MIME_MAP = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
    ".gif": "image/gif", ".webp": "image/webp",
    ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".opus": "audio/opus",
    ".wav": "audio/wav", ".m4a": "audio/mp4",
    ".mp4": "video/mp4", ".avi": "video/x-msvideo", ".mov": "video/quicktime",
    ".webm": "video/webm",
    ".pdf": "application/pdf", ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".txt": "text/plain",
}


async def verify_admin_token(
    authorization: Optional[str] = Header(None),
):
    if not authorization:
        raise HTTPException(status_code=401, detail="Cabeçalho de autorização obrigatório")
    token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization
    if token != settings.BRIDGE_AUTH_TOKEN:
        raise HTTPException(status_code=401, detail="Token de admin inválido")


@router.post("/")
async def upload_file(
    file: UploadFile = File(...),
    _=Depends(verify_admin_token),
):
    """Upload a media file for use in funnels."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Nome do arquivo obrigatório")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Tipo de arquivo não permitido: {ext}")

    # Read and check size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Arquivo excede o tamanho máximo de 20MB")

    # Create upload directory
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    # Generate unique filename
    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = UPLOAD_DIR / unique_name

    with open(file_path, "wb") as f:
        f.write(content)

    logger.info(f"File uploaded: {unique_name} ({len(content)} bytes)")

    return {
        "filename": unique_name,
        "original_name": file.filename,
        "url": f"/uploads/{unique_name}",
        "size": len(content),
        "mime_type": MIME_MAP.get(ext, "application/octet-stream"),
    }


@router.get("/{filename}")
async def get_uploaded_file(
    filename: str,
    _=Depends(verify_admin_token),
):
    """Serve an uploaded file."""
    # Prevent path traversal
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Nome de arquivo inválido")

    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")

    ext = Path(filename).suffix.lower()
    media_type = MIME_MAP.get(ext, "application/octet-stream")

    return FileResponse(file_path, media_type=media_type, filename=filename)
