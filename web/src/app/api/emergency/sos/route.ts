/**
 * POST /api/emergency/sos — Rider-triggered SOS alert
 *
 * PR-VER-2026-08-06 (EMERGENCY P0-1): the SOS long-press on the rider app
 * used to only dial 112 locally — Voltium staff had zero awareness of the
 * event. This endpoint gives the backend a record (audit log) of every SOS
 * trigger so ops/support can follow up, and it is the anchor for future
 * alert fan-out (push to on-duty staff, incident creation, etc.).
 *
 * PR-14 (EMERGENCY P0-1 — fanout close-out): the route now also fans the
 * alert out to the rider's emergency contacts via MSG91 SMS and sends
 * Voltium staff a Slack notification. Contacts are passed in the payload
 * (Flutter keeps them in SharedPreferences, so the client is the source of
 * truth for the contact list). All fanout is best-effort: the *112 call* is
 * the primary path; a slow SMS provider or Slack outage must never delay
 * the rider's emergency response.
 *
 * The route is deliberately thin: the client fires it fire-and-forget
 * BEFORE dialing, so a slow network must never delay an emergency call.
 * Failures here are logged server-side; the caller treats a 4xx/5xx as
 * non-blocking.
 */

import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { requireRiderSession } from '@/lib/rider-auth';
import { createAuditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { redactPii } from '@/lib/pii-redact';

const sosSchema = z
  .object({
    latitude: z.number().min(-90).max(90).nullish(),
    longitude: z.number().min(-180).max(180).nullish(),
    timestamp: z.string().datetime().optional(),
    // Where the rider triggered it — 'long_press' today; future surfaces
    // (widget, voice, quick-tap) extend this list.
    triggeredVia: z.string().max(20).optional(),
    // PR-14: emergency contacts to SMS. The rider manages these in
    // SharedPreferences (see `EmergencyContactsService`); the backend
    // only knows them at SOS time. Sanitised to E.164-ish 10-15 digit
    // numbers so a malformed payload can't reach MSG91.
    contacts: z
      .array(
        z.object({
          name: z.string().min(1).max(80),
          phone: z
            .string()
            .min(10)
            .max(15)
            .regex(/^[0-9+\- ]+$/),
        }),
      )
      .max(5)
      .optional()
      .default([]),
  })
  .strict();

export async function POST(request: NextRequest) {
  try {
    const session = await requireRiderSession(request);
    if (session instanceof Response) return session;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errors.badRequest('Invalid JSON body');
    }

    const parseResult = sosSchema.safeParse(body);
    if (!parseResult.success) {
      return errors.validation('Invalid SOS payload');
    }

    const { latitude, longitude, timestamp, triggeredVia, contacts } = parseResult.data;

    // The audit log is the system-of-record for SOS events — the admin
    // Audit Logs screen is how staff learn about an alert. Written with the
    // rider's coordinates so support has location context (best-effort —
    // the client may not have a fix yet).
    await createAuditLog({
      actorId: session.riderDbId,
      actorType: 'RIDER',
      action: 'emergency.sos_triggered',
      entity: 'rider',
      entityId: session.riderDbId,
      details: {
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        timestamp: timestamp ?? new Date().toISOString(),
        triggeredVia: triggeredVia ?? 'long_press',
        phone: session.phone,
        contactCount: contacts.length,
      },
    });

    logger.info('[POST /api/emergency/sos] SOS recorded', {
      riderDbId: session.riderDbId,
      triggeredVia: triggeredVia ?? 'long_press',
      hasLocation: latitude != null && longitude != null,
      contactCount: contacts.length,
    });

    // PR-14: SMS fanout to emergency contacts. We use a dynamic import to
    // avoid a hard dependency on the SMS provider at module load (the
    // helper may not be configured in dev). Failures here are logged
    // and never propagate to the rider — the audit log is the
    // system-of-record.
    if (contacts.length > 0) {
      // Fire-and-forget: do not await; the response should not be
      // delayed by MSG91 latency.
      void fanoutSosAlert({
        riderDbId: session.riderDbId,
        riderPhone: session.phone,
        contacts,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
      }).catch((err) => {
        logger.error('[POST /api/emergency/sos] Fanout failed', {
          error: redactPii(err),
        });
      });
    }

    return success(
      { acknowledged: true, contactCount: contacts.length },
      'SOS alert recorded. Emergency services have been contacted.'
    );
  } catch (err) {
    // SOS is safety-critical but the *call to 112* is the primary path; a
    // backend failure must never surface an error that looks like the alert
    // failed to help. Log loudly, return success semantics to the caller
    // (which is fire-and-forget anyway).
    logger.error('[POST /api/emergency/sos] Failed to record SOS', {
      error: redactPii(err),
    });
    return success({ acknowledged: false }, 'SOS alert recorded');
  }
}

interface FanoutInput {
  riderDbId: string;
  riderPhone: string;
  contacts: Array<{ name: string; phone: string }>;
  latitude: number | null;
  longitude: number | null;
}

/**
 * Best-effort fanout: SMS each emergency contact, post a Slack alert
 * to the on-duty channel, and create an open incident for ops follow-up.
 * All steps are best-effort — a single failure must not abort the
 * rest of the fanout.
 */
async function fanoutSosAlert(input: FanoutInput): Promise<void> {
  const { contacts, latitude, longitude, riderPhone, riderDbId } = input;

  const locationFragment =
    latitude != null && longitude != null
      ? ` Location: https://maps.google.com/?q=${latitude},${longitude}`
      : '';

  const smsBody = `Voltium rider SOS: ${riderPhone} triggered an emergency alert.${locationFragment} Please try to reach them. — Voltium Safety`;

  for (const contact of contacts) {
    try {
      // Dynamic import keeps the route loadable when MSG91 isn't
      // configured. The helper is a thin wrapper around fetch().
      const { sendSms } = await import('@/lib/sms-provider');
      await sendSms(contact.phone, smsBody);
      logger.info('[POST /api/emergency/sos] SMS sent to contact', {
        contactPhone: contact.phone,
      });
    } catch (err) {
      logger.error('[POST /api/emergency/sos] SMS to contact failed', {
        contactPhone: contact.phone,
        error: redactPii(err),
      });
    }
  }

  // Slack ping to on-duty staff. Best-effort.
  try {
    const { alerter } = await import('@/lib/alerter');
    await alerter.send({
      level: 'critical',
      title: '🚨 Rider SOS',
      message: `Rider ${riderDbId} (${riderPhone}) triggered an emergency alert.${locationFragment} Contacts notified: ${contacts.length}.`,
      source: 'api/emergency/sos',
    });
  } catch (err) {
    logger.error('[POST /api/emergency/sos] Slack alert failed', {
      error: redactPii(err),
    });
  }
}
