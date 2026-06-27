-- Migration: prevent_rider_delete
-- Adds a trigger to prevent hard-deleting riders to protect financial integrity.
-- Riders must be soft-deleted by setting lifecycleStatus = 'CLOSED'.

CREATE OR REPLACE FUNCTION prevent_rider_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Hard-deleting a Rider is strictly prohibited to preserve financial and audit records. Use soft-delete (lifecycleStatus = CLOSED) instead.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_rider_delete ON "Rider";
CREATE TRIGGER trg_prevent_rider_delete
  BEFORE DELETE ON "Rider"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_rider_delete();
