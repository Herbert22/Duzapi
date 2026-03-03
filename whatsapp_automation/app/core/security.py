import secrets
import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "HS256"
_PBKDF2_PREFIX = "pbkdf2:"
_ENC_PREFIX = "enc:"


# ---------------------------------------------------------------------------
# Password hashing (bcrypt)
# ---------------------------------------------------------------------------

def hash_password(plain: str) -> str:
    """Hash a password using bcrypt."""
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a password against its bcrypt hash."""
    return pwd_context.verify(plain, hashed)


# ---------------------------------------------------------------------------
# API Key — PBKDF2 hashing with backward-compatible SHA256 fallback
# ---------------------------------------------------------------------------

def generate_api_key() -> str:
    """Generate a secure random API key."""
    return secrets.token_urlsafe(32)


def hash_api_key(api_key: str) -> str:
    """Hash an API key using PBKDF2-HMAC-SHA256 with a random salt.

    Format: ``pbkdf2:<hex_salt>:<hex_hash>``
    """
    salt = os.urandom(32)
    dk = hashlib.pbkdf2_hmac("sha256", api_key.encode(), salt, 260_000)
    return f"{_PBKDF2_PREFIX}{salt.hex()}:{dk.hex()}"


def verify_api_key(plain_key: str, stored_hash: str) -> bool:
    """Verify an API key against a stored hash.

    Supports both the new PBKDF2 format and the legacy SHA256 format for
    backward compatibility with keys hashed before the upgrade.
    """
    if stored_hash.startswith(_PBKDF2_PREFIX):
        # New format: pbkdf2:<hex_salt>:<hex_hash>
        parts = stored_hash[len(_PBKDF2_PREFIX):].split(":")
        if len(parts) != 2:
            return False
        salt = bytes.fromhex(parts[0])
        expected = bytes.fromhex(parts[1])
        dk = hashlib.pbkdf2_hmac("sha256", plain_key.encode(), salt, 260_000)
        return hmac.compare_digest(dk, expected)
    else:
        # Legacy SHA256 format — timing-safe comparison
        legacy_hash = hashlib.sha256(plain_key.encode()).hexdigest()
        return hmac.compare_digest(legacy_hash, stored_hash)


# ---------------------------------------------------------------------------
# JWT tokens
# ---------------------------------------------------------------------------

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    """Decode and verify a JWT access token. Returns None on failure."""
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None


# ---------------------------------------------------------------------------
# Fernet encryption for sensitive values (e.g. tenant OpenAI API keys)
# ---------------------------------------------------------------------------

def _get_fernet():
    """Return a Fernet instance, auto-generating a key if ENCRYPTION_KEY is empty."""
    from cryptography.fernet import Fernet
    key = settings.ENCRYPTION_KEY
    if not key:
        # In dev with no key configured, generate a temporary one.
        # In production ENCRYPTION_KEY must be set so values persist across restarts.
        return Fernet(Fernet.generate_key())
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_value(plain: str) -> str:
    """Encrypt a string and return ``enc:<base64_ciphertext>``."""
    if not plain:
        return plain
    token = _get_fernet().encrypt(plain.encode()).decode()
    return f"{_ENC_PREFIX}{token}"


def decrypt_value(stored: str) -> str:
    """Decrypt a value produced by ``encrypt_value``.

    Falls back to returning the original string if it is not encrypted
    (for transparent migration of existing plaintext values).
    """
    if not stored or not stored.startswith(_ENC_PREFIX):
        return stored  # plaintext — return as-is (migration path)
    ciphertext = stored[len(_ENC_PREFIX):]
    try:
        return _get_fernet().decrypt(ciphertext.encode()).decode()
    except Exception:
        return stored  # decryption failed, return raw (should not happen in prod)


# ---------------------------------------------------------------------------
# HMAC signature verification (Bridge → Backend webhook authentication)
# ---------------------------------------------------------------------------

def sign_payload(payload: bytes) -> str:
    """Produce ``sha256=<hex>`` HMAC signature for a payload."""
    sig = hmac.new(
        settings.WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()
    return f"sha256={sig}"


def verify_webhook_signature(payload: bytes, signature: str) -> bool:
    """Verify the ``X-Bridge-Signature`` header from the WhatsApp bridge.

    Expected format: ``sha256=<hex_hmac>``
    """
    expected = sign_payload(payload)
    return hmac.compare_digest(expected, signature or "")
