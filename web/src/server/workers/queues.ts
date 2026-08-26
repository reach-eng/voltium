/**
 * Job type definitions for Voltium background workers.
 *
 * Re-exports the canonical event types from outbox.ts as JOB_TYPES.
 * Use this enum when defining worker poll types in workers/index.ts.
 *
 * The canonical source of truth is OutboxEventTypes in outbox.ts.
 * Add new event types there, not here.
 */

import { OutboxEventTypes } from './outbox';

export const JOB_TYPES = OutboxEventTypes;

export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES];
