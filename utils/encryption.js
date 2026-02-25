/**
 * Simple AES-256-GCM encryption for sensitive settings (API keys, tokens).
 * Derives a 32-byte key from the application's JWT_SECRET using PBKDF2.
 */

const crypto = require('crypto');
const config = require('../config/environment');

const ALGORITHM = 'aes-256-gcm';
const SALT = 'deployassist-settings-v1';
const ITERATIONS = 100_000;
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

let _derivedKey = null;

function getDerivedKey() {
    if (_derivedKey) return _derivedKey;
    const secret = config.auth.jwtSecret || 'fallback-dev-secret';
    _derivedKey = crypto.pbkdf2Sync(secret, SALT, ITERATIONS, KEY_LENGTH, 'sha256');
    return _derivedKey;
}

/**
 * Encrypt a plaintext string.
 * @param {string} plaintext
 * @returns {string} Base64-encoded ciphertext (iv + authTag + encrypted)
 */
function encrypt(plaintext) {
    if (!plaintext) return '';
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, getDerivedKey(), iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

/**
 * Decrypt a Base64-encoded ciphertext produced by encrypt().
 * @param {string} ciphertext
 * @returns {string} Decrypted plaintext
 */
function decrypt(ciphertext) {
    if (!ciphertext) return '';
    const buf = Buffer.from(ciphertext, 'base64');
    const iv = buf.subarray(0, IV_LENGTH);
    const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, getDerivedKey(), iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8');
}

/**
 * Mask a secret for display (show first 3 and last 4 chars).
 * @param {string} value
 * @returns {string}
 */
function mask(value) {
    if (!value || value.length < 10) return '••••••••';
    return value.slice(0, 3) + '••••••••' + value.slice(-4);
}

module.exports = { encrypt, decrypt, mask };
