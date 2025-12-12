/**
 * SML Authentication Utilities
 * 
 * Provides token validation and automatic refresh capabilities
 * using Playwright for SSO authentication.
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { Logger } from './logger';

const CONFIG_FILE = '.sml_config.json';

interface SMLConfig {
  environment: 'euw1' | 'use1';
  authCookie: string;
  refreshedAt?: string;
  expiresAt?: string;
}

interface TokenPayload {
  exp?: number;
  iat?: number;
  username?: string;
  tenant_id?: string;
  iss?: string;
  [key: string]: unknown;
}

/**
 * Decode JWT token payload (without verification)
 */
export function decodeJWT(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = Buffer.from(parts[1], 'base64').toString('utf8');
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

/**
 * Check if token is expired or about to expire
 * @param token - JWT token string
 * @param bufferSeconds - Number of seconds before expiration to consider expired (default: 300 = 5 minutes)
 */
export function isTokenExpired(token: string, bufferSeconds: number = 300): boolean {
  const payload = decodeJWT(token);
  if (!payload || !payload.exp) return true;
  
  const now = Math.floor(Date.now() / 1000);
  return payload.exp <= (now + bufferSeconds);
}

/**
 * Get token expiration info
 */
export function getTokenExpiration(token: string): { 
  expired: boolean; 
  expiresAt: Date | null; 
  remainingSeconds: number;
  remainingMinutes: number;
} {
  const payload = decodeJWT(token);
  if (!payload || !payload.exp) {
    return { 
      expired: true, 
      expiresAt: null, 
      remainingSeconds: 0,
      remainingMinutes: 0
    };
  }
  
  const now = Math.floor(Date.now() / 1000);
  const remainingSeconds = Math.max(0, payload.exp - now);
  
  return {
    expired: remainingSeconds <= 0,
    expiresAt: new Date(payload.exp * 1000),
    remainingSeconds,
    remainingMinutes: Math.floor(remainingSeconds / 60)
  };
}

/**
 * Load SML configuration from disk
 */
export async function loadConfig(): Promise<SMLConfig | null> {
  try {
    const configPath = path.resolve(CONFIG_FILE);
    const data = await fs.readFile(configPath, 'utf8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Load SML configuration synchronously
 */
export function loadConfigSync(): SMLConfig | null {
  try {
    const configPath = path.resolve(CONFIG_FILE);
    const data = fsSync.readFileSync(configPath, 'utf8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Save SML configuration to disk
 */
export async function saveConfig(config: SMLConfig): Promise<void> {
  const configPath = path.resolve(CONFIG_FILE);
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
}

/**
 * Trigger token refresh using Playwright script
 * 
 * This runs the sml-token-refresh.ts script in a subprocess.
 * Returns true if refresh was successful.
 * 
 * Note: This will open a browser window for SSO authentication.
 * For automated/headless scenarios, use the manual token approach.
 */
export async function triggerTokenRefresh(
  environment: 'euw1' | 'use1' = 'euw1',
  options: { 
    timeout?: number;
    silent?: boolean;
  } = {}
): Promise<boolean> {
  const { timeout = 300000, silent = false } = options; // 5 minute timeout

  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'sml-token-refresh.ts');
    
    if (!silent) {
      Logger.info('Triggering SML token refresh', { environment, scriptPath });
    }

    const child = spawn('npx', ['ts-node', scriptPath, environment], {
      cwd: path.join(__dirname, '..', '..'),
      shell: true,
      stdio: silent ? 'ignore' : 'inherit'
    });

    const timer = setTimeout(() => {
      child.kill();
      if (!silent) {
        Logger.warn('SML token refresh timed out');
      }
      resolve(false);
    }, timeout);

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        if (!silent) {
          Logger.info('SML token refresh completed successfully');
        }
        resolve(true);
      } else {
        if (!silent) {
          Logger.warn('SML token refresh failed', { exitCode: code });
        }
        resolve(false);
      }
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      if (!silent) {
        Logger.error('SML token refresh error', error);
      }
      resolve(false);
    });
  });
}

/**
 * Check token status and optionally trigger refresh
 */
export async function checkTokenStatus(options: {
  autoRefresh?: boolean;
  bufferMinutes?: number;
} = {}): Promise<{
  valid: boolean;
  expired: boolean;
  expiresAt: Date | null;
  remainingMinutes: number;
  refreshTriggered?: boolean;
}> {
  const { autoRefresh = false, bufferMinutes = 5 } = options;
  
  const config = await loadConfig();
  
  if (!config || !config.authCookie) {
    if (autoRefresh) {
      const refreshed = await triggerTokenRefresh(config?.environment || 'euw1');
      return {
        valid: refreshed,
        expired: true,
        expiresAt: null,
        remainingMinutes: 0,
        refreshTriggered: true
      };
    }
    return {
      valid: false,
      expired: true,
      expiresAt: null,
      remainingMinutes: 0
    };
  }

  const expInfo = getTokenExpiration(config.authCookie);
  const needsRefresh = expInfo.remainingMinutes < bufferMinutes;

  if (needsRefresh && autoRefresh) {
    const refreshed = await triggerTokenRefresh(config.environment);
    return {
      valid: refreshed,
      expired: expInfo.expired,
      expiresAt: expInfo.expiresAt,
      remainingMinutes: expInfo.remainingMinutes,
      refreshTriggered: true
    };
  }

  return {
    valid: !expInfo.expired,
    expired: expInfo.expired,
    expiresAt: expInfo.expiresAt,
    remainingMinutes: expInfo.remainingMinutes
  };
}

/**
 * Validate that the current token works by checking its structure
 */
export function validateToken(token: string): {
  valid: boolean;
  error?: string;
  payload?: TokenPayload;
} {
  if (!token) {
    return { valid: false, error: 'Token is empty' };
  }

  const payload = decodeJWT(token);
  if (!payload) {
    return { valid: false, error: 'Invalid JWT format' };
  }

  if (payload.iss !== 'RMS') {
    return { valid: false, error: 'Token not issued by RMS' };
  }

  if (isTokenExpired(token, 0)) {
    return { valid: false, error: 'Token is expired', payload };
  }

  return { valid: true, payload };
}
