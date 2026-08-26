/**
 * R3.7h split — Earnings tab header.
 *
 * H2 + subtitle. Static (no actions), so this is a pure presentational
 * component.
 */
export function EarningsHeader() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground">Rider Earnings</h2>
      <p className="text-muted-foreground text-sm mt-1">View rider self-reported earnings</p>
    </div>
  );
}
