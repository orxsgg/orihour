import { NextRequest } from 'next/server';

interface RateBucket {
  count: number;
  resetAt: number;
}

// In-memory sliding window store per serverless/node instance
const rateStore = new Map<string, RateBucket>();

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

/**
 * Rate limiter to mitigate bots, brute-force, and spam flooding.
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const existing = rateStore.get(key);

  // Periodic cleanup to avoid unbounded memory growth
  if (rateStore.size > 2000) {
    for (const [k, v] of rateStore.entries()) {
      if (v.resetAt <= now) rateStore.delete(k);
    }
  }

  if (!existing || existing.resetAt <= now) {
    rateStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }

  if (existing.count >= maxRequests) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

/**
 * Strips HTML tags, null bytes, and control characters to prevent XSS / injection payloads.
 */
export function sanitizePlainText(input: unknown, maxLen: number): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/<[^>]*>?/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

/**
 * Validates that a URL is strictly http/https (blocks javascript: or data: XSS vectors).
 */
export function sanitizeSafeUrl(input: unknown): string {
  if (typeof input !== 'string') return '';
  const trimmed = input.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return '';
  } catch {
    return '';
  }
}

/**
 * Validates safe record IDs (alphanumeric, dashes, underscores only).
 */
export function isValidRecordId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{2,64}$/.test(id);
}