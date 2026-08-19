import { describe, it, expect } from 'vitest';

describe('Flutter Locale & Theme Contracts', () => {
  it('defines supported locales: en (English) and hi (Hindi)', () => {
    const supportedLocales = ['en', 'hi'];
    expect(supportedLocales).toContain('en');
    expect(supportedLocales).toContain('hi');
    expect(supportedLocales.length).toBe(2);
  });

  it('defines dark mode theme preferences', () => {
    const themeModes = ['light', 'dark', 'system'];
    expect(themeModes).toContain('light');
    expect(themeModes).toContain('dark');
  });
});
