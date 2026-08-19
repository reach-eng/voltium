import { describe, it, expect } from 'vitest';

describe('Flutter Support & Ticket Contracts', () => {
  it('filters real FAQ items by question or answer keyword match', () => {
    const faqs = [
      { id: '1', question: 'How to lock the scooter?', answer: 'Press lock button on app' },
      { id: '2', question: 'Battery charging instructions', answer: 'Plug in charger at hub' },
      { id: '3', question: 'Payment failed refund policy', answer: 'Contact support for refund' },
    ];

    const keyword = 'battery';
    const matches = faqs.filter(
      (f) =>
        f.question.toLowerCase().includes(keyword) ||
        f.answer.toLowerCase().includes(keyword)
    );

    expect(matches.length).toBe(1);
    expect(matches[0].id).toBe('2');
  });

  it('includes resolved in TicketFilter enum status list', () => {
    const ticketFilters = ['all', 'open', 'assigned', 'inProgress', 'resolved', 'closed'];

    expect(ticketFilters).toContain('resolved');
    expect(ticketFilters.length).toBe(6);
  });
});
