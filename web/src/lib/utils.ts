import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Tailwind class merger with deduplication
 * Handles conflicting classes by using tailwind-merge
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Create class string with explicit deduplication
 * Use when you need deterministic ordering
 */
export function cnd(...inputs: (string | undefined | null | false)[]): string {
  return twMerge(inputs as string[]);
}

/**
 * Generate a random alphanumeric password
 */
export function generateRandomPassword(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
