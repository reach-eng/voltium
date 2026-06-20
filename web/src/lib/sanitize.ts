import createDOMPurify from 'isomorphic-dompurify';

const DOMPurify = createDOMPurify();

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
  ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
  ALLOWED_URI_REGEXP:
    /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
};

export function sanitizeHtml(input: string): string {
  return DOMPurify.sanitize(input, SANITIZE_CONFIG);
}

export function sanitizeText(input: string): string {
  return input.replace(/[<>]/g, '').trim();
}

export function sanitizeForAttribute(input: string): string {
  return input.replace(/["'<>&]/g, '');
}
