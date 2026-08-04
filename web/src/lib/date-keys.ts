/**
 * Date key formatting utilities.
 * 
 * Provides consistent IST (Asia/Kolkata) date string formatting ('YYYY-MM-DD')
 * across all scheduled daily jobs.
 */

export function istDateKey(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}
