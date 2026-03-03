/**
 * Utilitário de criptografia para dados sensíveis
 * Usa AES-256-GCM para criptografia simétrica
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Deriva uma chave a partir da secret key usando PBKDF2
 */
function deriveKey(secretKey: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(secretKey, salt, 100000, 32, 'sha256');
}

/**
 * Obtém a chave de criptografia do ambiente
 */
function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET;
  if (!key) {
    throw new Error('ENCRYPTION_KEY ou NEXTAUTH_SECRET não configurado');
  }
  return key;
}

/**
 * Criptografa um texto
 * @param plaintext - Texto a ser criptografado
 * @returns String criptografada em formato: salt:iv:authTag:ciphertext (base64)
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return '';
  
  const secretKey = getEncryptionKey();
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(secretKey, salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  const authTag = cipher.getAuthTag();

  // Formato: salt:iv:authTag:ciphertext (tudo em base64)
  return [
    salt.toString('base64'),
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted,
  ].join(':');
}

/**
 * Descriptografa um texto
 * @param encryptedText - Texto criptografado no formato salt:iv:authTag:ciphertext
 * @returns Texto original
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return '';
  
  // Verifica se já é texto plano (não criptografado)
  if (!encryptedText.includes(':')) {
    return encryptedText;
  }

  const secretKey = getEncryptionKey();
  const parts = encryptedText.split(':');
  
  if (parts.length !== 4) {
    // Pode ser uma API key antiga não criptografada
    return encryptedText;
  }

  const [saltB64, ivB64, authTagB64, ciphertext] = parts;
  
  const salt = Buffer.from(saltB64, 'base64');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const key = deriveKey(secretKey, salt);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Verifica se um texto está criptografado
 */
export function isEncrypted(text: string): boolean {
  if (!text) return false;
  const parts = text.split(':');
  return parts.length === 4;
}

/**
 * Mascara uma API key para exibição
 * Ex: sk-abc123xyz -> sk-abc...xyz
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey) return '';
  
  // Descriptografa se necessário
  const key = isEncrypted(apiKey) ? decrypt(apiKey) : apiKey;
  
  if (key.length <= 8) {
    return '***';
  }
  
  const prefix = key.slice(0, 7);
  const suffix = key.slice(-4);
  return `${prefix}...${suffix}`;
}

/**
 * Hash seguro para comparação (não reversível)
 */
export function secureHash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}
