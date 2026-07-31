import { z } from 'zod';
import { logger } from '@/lib/logger';

export const phoneSchema = z
  .string()
  .transform((val) => val.trim().replace(/^(\+91|91)/, '').replace(/\D/g, ''))
  .pipe(z.string().regex(/^\d{10}$/, 'Phone must be a valid 10-digit number'));

// Helper: validate request body and return parsed data or error response
export function validateBody<T>(schema: z.ZodType<T>, body: unknown) {
  const result = schema.safeParse(body);
  if (!result.success) {
    logger.debug('[Validation Error]', { errors: result.error.format() });
    const firstError = result.error.issues[0];
    const fieldPath = firstError?.path.join('.');
    const errorMessage = fieldPath
      ? `${fieldPath}: ${firstError.message}`
      : firstError?.message || 'Validation failed';
    return {
      success: false as const,
      error: errorMessage,
      data: null as T | null,
    };
  }
  return { success: true as const, error: null, data: result.data };
}
