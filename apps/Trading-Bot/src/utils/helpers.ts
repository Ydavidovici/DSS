/**
 * Utility helper functions
 */

/**
 * Format a date to ISO string
 */
export function formatDate(date: Date | string | number): string {
  if (typeof date === 'string') return date;
  if (typeof date === 'number') return new Date(date).toISOString();
  return date.toISOString();
}

/**
 * Parse various date formats to Date object
 */
export function parseDate(date: Date | string | number): Date {
  if (date instanceof Date) return date;
  if (typeof date === 'number') return new Date(date);
  return new Date(date);
}

/**
 * Format a number as USD currency
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a number as percentage
 */
export function formatPercent(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

/**
 * Round a number to specified decimal places
 */
export function round(value: number, decimals: number = 2): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}

/**
 * Sleep/delay for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error('Retry failed');
}

/**
 * Calculate percentage change between two values
 */
export function percentChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) return 0;
  return ((newValue - oldValue) / oldValue) * 100;
}

/**
 * Check if current time is within market hours (9:30 AM - 4:00 PM ET, Mon-Fri)
 * Note: This is a simplified check, doesn't account for holidays
 */
export function isMarketOpen(date: Date = new Date()): boolean {
  const day = date.getUTCDay();
  // Weekend check (0 = Sunday, 6 = Saturday)
  if (day === 0 || day === 6) return false;

  // Convert to ET (UTC-5 or UTC-4 depending on DST)
  // Simplified: using UTC-5 for now
  const hour = (date.getUTCHours() - 5 + 24) % 24;
  const minute = date.getUTCMinutes();

  // Market hours: 9:30 AM - 4:00 PM ET
  const openTime = 9 * 60 + 30; // 9:30 AM in minutes
  const closeTime = 16 * 60; // 4:00 PM in minutes
  const currentTime = hour * 60 + minute;

  return currentTime >= openTime && currentTime < closeTime;
}

/**
 * Parse comma-separated string to array
 */
export function parseList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Generate unique ID (simple timestamp-based)
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
