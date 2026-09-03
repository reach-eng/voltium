-- Migration: add_state_machine_transition_guards
-- Enforces DB-level transition constraints and prevents invalid state regressions on financial and lifecycle state machines.

-- 1. Transactions State Machine Trigger
CREATE OR REPLACE FUNCTION guard_transaction_status_transitions()
RETURNS TRIGGER AS $$
BEGIN
  -- Terminal states cannot regress to PENDING
  IF OLD.status IN ('APPROVED', 'REJECTED', 'REVERSED') AND NEW.status = 'PENDING' THEN
    RAISE EXCEPTION 'Illegal transaction status transition: Cannot revert terminal status % to PENDING (transaction %)', OLD.status, OLD.id;
  END IF;

  -- REJECTED transactions cannot be directly APPROVED without creating a new transaction
  IF OLD.status = 'REJECTED' AND NEW.status = 'APPROVED' THEN
    RAISE EXCEPTION 'Illegal transaction status transition: Cannot approve a REJECTED transaction (transaction %)', OLD.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guard_transaction_status ON "transactions";
CREATE TRIGGER trg_guard_transaction_status
  BEFORE UPDATE OF "status" ON "transactions"
  FOR EACH ROW
  EXECUTE FUNCTION guard_transaction_status_transitions();

-- 2. Deposit Records State Machine Trigger
CREATE OR REPLACE FUNCTION guard_deposit_status_transitions()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('APPROVED', 'REJECTED', 'REFUNDED', 'FORFEITED') AND NEW.status = 'PENDING' THEN
    RAISE EXCEPTION 'Illegal deposit status transition: Cannot revert terminal status % to PENDING (deposit %)', OLD.status, OLD.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guard_deposit_status ON "deposit_records";
CREATE TRIGGER trg_guard_deposit_status
  BEFORE UPDATE OF "status" ON "deposit_records"
  FOR EACH ROW
  EXECUTE FUNCTION guard_deposit_status_transitions();

-- 3. Rental Leases State Machine Trigger
CREATE OR REPLACE FUNCTION guard_rental_lease_status_transitions()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('COMPLETED', 'CANCELLED') AND NEW.status = 'PENDING' THEN
    RAISE EXCEPTION 'Illegal rental lease status transition: Cannot revert terminal status % to PENDING (lease %)', OLD.status, OLD.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guard_rental_lease_status ON "rental_leases";
CREATE TRIGGER trg_guard_rental_lease_status
  BEFORE UPDATE OF "status" ON "rental_leases"
  FOR EACH ROW
  EXECUTE FUNCTION guard_rental_lease_status_transitions();
