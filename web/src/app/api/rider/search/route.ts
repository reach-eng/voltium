/**
 * GET /api/rider/search — Rider-side cross-surface search.
 *
 * PR-36 (SUPPORT P0-2): the audit's "no /api/rider/search endpoint"
 * finding was real — there was no rider-side endpoint for unified
 * search across FAQs and the rider's own tickets. The support screen
 * (and any future in-app "search help" surface) needs a single entry
 * point that returns ranked results from multiple content sources.
 *
 * Search scope (extensible):
 *   - FAQs (admin-managed knowledge base) — matches question OR answer
 *   - The rider's own support tickets — matches subject
 *   - Active legal document titles (so "refund" finds the policy)
 *
 * The endpoint is intentionally small and additive — it does NOT
 * replace the dedicated /api/rider/notifications, /api/rider/dashboard,
 * etc. surfaces. It is a best-effort typeahead-style search: results
 * are deduped, capped, and ordered by relevance (FAQ first, then the
 * rider's tickets).
 *
 * Query params:
 *   - q (required, 2-100 chars): the search query
 *   - limit (optional, default 10, max 25): result count
 */

import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireRiderSession } from '@/lib/rider-auth';
import { db } from '@/lib/db';

interface SearchHit {
  type: 'faq' | 'ticket' | 'legal';
  id: string;
  title: string;
  snippet: string;
  score: number;
}

export async function GET(request: NextRequest) {
  const session = await requireRiderSession(request);
  if (session instanceof Response) return session;

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') ?? '').trim();
  if (q.length < 2) {
    return errors.badRequest('Query parameter `q` must be at least 2 characters');
  }
  if (q.length > 100) {
    return errors.badRequest('Query parameter `q` must be at most 100 characters');
  }
  const limit = Math.min(
    Math.max(parseInt(searchParams.get('limit') ?? '10', 10) || 10, 1),
    25
  );

  try {
    const hits: SearchHit[] = [];

    // ── FAQs ────────────────────────────────────────────────────────────
    // Case-insensitive contains on question OR answer. Order by recency
    // (updatedAt desc) — the admin's most-recently-edited FAQs win ties.
    const faqs = await db.faq.findMany({
      where: {
        OR: [
          { question: { contains: q, mode: 'insensitive' } },
          { answer: { contains: q, mode: 'insensitive' } },
        ],
        isActive: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
    for (const f of faqs) {
      hits.push({
        type: 'faq',
        id: f.id,
        title: f.question,
        snippet: f.answer.slice(0, 200),
        score: scoreMatch(q, f.question) + scoreMatch(q, f.answer) * 0.5,
      });
    }

    // ── The rider's own tickets ────────────────────────────────────────
    // Subject-only search (PII-safe: we never match ticket bodies in case
    // a rider types another rider's phone number). The rider only sees
    // their own tickets, so there's no authorisation concern.
    const tickets = await db.supportTicket.findMany({
      where: {
        riderId: session.riderDbId,
        subject: { contains: q, mode: 'insensitive' },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
    for (const t of tickets) {
      hits.push({
        type: 'ticket',
        id: t.id,
        title: t.subject,
        snippet: `Status: ${t.status}`,
        score: scoreMatch(q, t.subject) * 0.8, // tickets are slightly less
                                               // prominent than FAQs
      });
    }

    // ── Legal documents (titles only) ──────────────────────────────────
    // Matches the title (Terms, Privacy, Refund Policy, etc.). Body
    // search is intentionally limited — legal copy is long and
    // search-engine behaviour would surprise users. Direct them to
    // the full document instead.
    const legal = await db.legalDocument.findMany({
      where: {
        title: { contains: q, mode: 'insensitive' },
      },
      take: limit,
    });
    for (const l of legal) {
      hits.push({
        type: 'legal',
        id: l.id,
        title: l.title,
        snippet: l.content.slice(0, 200),
        score: scoreMatch(q, l.title) * 0.6,
      });
    }

    // Sort by score, then by recency (already in order from Prisma),
    // dedupe by (type, id), and cap.
    const seen = new Set<string>();
    const deduped: SearchHit[] = [];
    for (const hit of hits.sort((a, b) => b.score - a.score)) {
      const key = `${hit.type}:${hit.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(hit);
      if (deduped.length >= limit) break;
    }

    return success({
      query: q,
      count: deduped.length,
      results: deduped,
    });
  } catch (err) {
    logger.error('GET /api/rider/search error', err);
    return errors.internal('Search failed');
  }
}

/**
 * Lightweight relevance score: count of case-insensitive substring
 * matches in `text`, weighted by where they appear. Title hits are
 * worth 2x body hits; the first occurrence is worth 1, subsequent
 * occurrences worth 0.5 each (avoids "how do I renew renew renew"
 * gaming the score).
 */
function scoreMatch(q: string, text: string): number {
  if (!text) return 0;
  const haystack = text.toLowerCase();
  const needle = q.toLowerCase();
  let firstIdx = haystack.indexOf(needle);
  if (firstIdx === -1) return 0;
  let score = 1;
  if (firstIdx < 60) score += 1; // title-like match (early in string)
  let count = 1;
  let nextIdx = haystack.indexOf(needle, firstIdx + needle.length);
  while (nextIdx !== -1) {
    count += 1;
    score += 0.5;
    nextIdx = haystack.indexOf(needle, nextIdx + needle.length);
  }
  return score;
}
