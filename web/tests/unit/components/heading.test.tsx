/**
 * Tests for `web/src/components/ui/heading.tsx`.
 *
 * The Heading component is the canonical replacement for raw
 * `<h1 className="text-2xl font-bold">` etc. (N6 design-system finding).
 * PR-27a is the component + test; screen migration is PR-27b+.
 *
 * We use `react-dom/server`'s `renderToStaticMarkup` to render the
 * component into an HTML string under the default vitest `node`
 * environment — no jsdom or @testing-library/react is wired up here.
 */

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { Heading } from '@/components/ui/heading';

describe('Heading', () => {
  it('renders an <h2> by default (level=2)', () => {
    const html = renderToStaticMarkup(<Heading>Default heading</Heading>);
    expect(html).toMatch(/^<h2[^>]*>Default heading<\/h2>$/);
  });

  it('renders the correct tag for each level 1-6', () => {
    for (const level of [1, 2, 3, 4, 5, 6] as const) {
      const html = renderToStaticMarkup(
        <Heading level={level}>Level {level}</Heading>,
      );
      expect(html).toMatch(new RegExp(`^<h${level}[^>]*>Level ${level}</h${level}>$`));
    }
  });

  it('applies the canonical className for the default level', () => {
    const html = renderToStaticMarkup(<Heading>Default</Heading>);
    expect(html).toContain('text-2xl');
    expect(html).toContain('font-semibold');
    expect(html).toContain('tracking-tight');
  });

  it('applies the canonical className for h1', () => {
    const html = renderToStaticMarkup(<Heading level={1}>Big</Heading>);
    expect(html).toContain('text-3xl');
    expect(html).toContain('font-bold');
    expect(html).toContain('tracking-tight');
  });

  it('applies the canonical className for h3', () => {
    const html = renderToStaticMarkup(<Heading level={3}>Medium</Heading>);
    expect(html).toContain('text-xl');
    expect(html).toContain('font-semibold');
  });

  it('applies the canonical className for h4', () => {
    const html = renderToStaticMarkup(<Heading level={4}>Sub</Heading>);
    expect(html).toContain('text-lg');
    expect(html).toContain('font-medium');
  });

  it('applies the canonical className for h6 (overline-style)', () => {
    const html = renderToStaticMarkup(<Heading level={6}>Eyebrow</Heading>);
    expect(html).toContain('text-sm');
    expect(html).toContain('font-medium');
    expect(html).toContain('uppercase');
    expect(html).toContain('tracking-wide');
  });

  it('merges a custom className onto the canonical styles', () => {
    const html = renderToStaticMarkup(
      <Heading className="text-center text-primary">Custom</Heading>,
    );
    // Canonical styles still present.
    expect(html).toContain('text-2xl');
    expect(html).toContain('font-semibold');
    // Custom classes appended.
    expect(html).toContain('text-center');
    expect(html).toContain('text-primary');
  });

  it('forwards the id prop', () => {
    const html = renderToStaticMarkup(
      <Heading id="page-title">Page title</Heading>,
    );
    expect(html).toContain('id="page-title"');
  });

  it('sets data-slot="heading" and data-level for tooling', () => {
    const html = renderToStaticMarkup(<Heading level={3}>Tools</Heading>);
    expect(html).toContain('data-slot="heading"');
    expect(html).toContain('data-level="3"');
  });

  it('forwards arbitrary HTML attributes (aria-label, role)', () => {
    const html = renderToStaticMarkup(
      <Heading level={2} aria-label="Section" role="heading">
        Section
      </Heading>,
    );
    expect(html).toContain('aria-label="Section"');
    expect(html).toContain('role="heading"');
  });

  it('renders nested children (not just text)', () => {
    const html = renderToStaticMarkup(
      <Heading level={2}>
        Hello <span className="text-primary">world</span>
      </Heading>,
    );
    expect(html).toContain('Hello');
    expect(html).toContain('<span class="text-primary">world</span>');
  });
});
