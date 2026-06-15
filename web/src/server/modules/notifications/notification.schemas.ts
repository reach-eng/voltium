/**
 * Notifications module - Zod validation schemas.
 */

import { z } from 'zod';
import { sendNotificationSchema } from '@/lib/validators';

export { sendNotificationSchema };

export type SendNotificationDto = z.infer<typeof sendNotificationSchema>;
