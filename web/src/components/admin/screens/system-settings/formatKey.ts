/**
 * R3.7k split — Key label formatter.
 *
 * SCREAMING_SNAKE_CASE → "Screaming Snake Case". Used everywhere a
 * raw setting key would otherwise leak into the UI.
 */
export function formatKeyLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
