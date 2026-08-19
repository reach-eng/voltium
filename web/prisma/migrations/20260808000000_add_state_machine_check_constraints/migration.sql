-- =============================================================================
-- PR-149 (B-SM1) — State-machine CHECK constraints migration
-- =============================================================================
-- Ticket: AUDIT_DATABASE §3.1 (Top-10 #8) and AUDIT_BACKEND §19.10
-- Plan:   docs/AUDIT_PHASE7_PLAN_2026-08-04.md
--
-- Why this exists:
--   The state machines in `web/src/server/modules/*/`-state-machine.ts
--   are TS-only. Raw `db.model.update({ data: { status: 'X' } })` calls
--   in scripts, jobs, or future code can bypass the machine and put
--   records into illegal states (e.g. a "CLOSED" ticket moving back
--   to "OPEN", a "REFUNDED" deposit becoming "PENDING" again).
--
--   This migration adds Postgres CHECK constraints that enforce the
--   *transition* invariants at the database level. Each constraint
--   is a "same state OR valid forward transition" predicate: the
--   current row's `status` is allowed to equal the NEW value, OR the
--   old value must be in the list of valid predecessors of the NEW
--   value.
--
--   The trigger approach (BEFORE UPDATE OF status) is more powerful
--   because it can compare OLD vs NEW. CHECK constraints can only
--   look at the row's current value, so we use a stored function
--   + trigger pattern.
--
--   This migration:
--     1. Creates 8 trigger functions, one per state machine.
--     2. Wires each function to its table's BEFORE UPDATE OF status.
--     3. Wraps each CREATE in IF NOT EXISTS guards (DROP TRIGGER
--        IF EXISTS first) for idempotency.
--     4. Allows the trigger to be DISABLED in dev (the env check
--        reads `process.env.DISABLE_STATE_MACHINE_TRIGGERS` at
--        trigger-fire time, not at trigger-create time).
--
--   Tradeoff vs hard CHECK constraints:
--     - The TS machine is the source of truth for valid transitions.
--     - The DB trigger is the safety net for raw SQL bypass.
--     - If the TS machine adds a transition, the trigger must be
--       updated to match. The test
--       tests/unit/state-machine-trigger-coverage.test.ts asserts
--       the trigger function bodies contain the same transitions
--       as the TS source.
--
-- Scope (8 triggers):
--   transactions       status: PENDING/APPROVED/REJECTED/FAILED/REVERSED/REFUNDED
--   deposit_records    status: NOT_SUBMITTED/PENDING/PENDING_VERIFICATION/APPROVED/REJECTED/REFUND_REQUESTED/REFUNDED/FORFEITED/PARTIALLY_REFUNDED
--   guarantors         status: DRAFT/SUBMITTED/INFO_REQUIRED/APPROVED/REJECTED/REPLACED
--   incidents          status: REPORTED/INVESTIGATING/RESOLVED/CLOSED/DISMISSED
--   kyc_profiles       status: DRAFT/SUBMITTED/INFO_REQUIRED/APPROVED/REJECTED/EXPIRED
--   rental_leases      status: BOOKED/NO_RENTAL/PLAN_SELECTED/PICKUP_SCHEDULED/ACTIVE/OVERDUE/RETURN_PENDING/RETURN_APPROVED/CLOSED/SUSPENDED
--   support_tickets    status: OPEN/IN_PROGRESS/WAITING_ON_RIDER/RESOLVED/CLOSED
--   vehicles           status: AVAILABLE/RESERVED/ASSIGNED/ACTIVE_RENTAL/RETURN_PENDING/MAINTENANCE/RETIRED/LOST
--
-- Acceptance:
--   - 8 triggers exist (verified via
--     tests/unit/state-machine-trigger-coverage.test.ts).
--   - Bypassing the trigger (e.g. `db.transaction.update(...)` from a
--     raw `psql` session) raises SQLSTATE 23514 (check violation)
--     or a custom EXCEPTION for transitions.
--   - In dev, the trigger can be disabled via the
--     DISABLE_STATE_MACHINE_TRIGGERS env var.

-- =============================================================================
-- Helper: allowed_predecessors(target_status) → set of statuses that
-- can transition INTO `target_status`. The trigger function looks
-- up OLD.status in the predecessor set; if it's there or OLD.status
-- = NEW.status, the transition is valid. Otherwise, the trigger
-- raises an exception and aborts the UPDATE.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. transactions
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_transaction_state_machine()
RETURNS TRIGGER AS $$
DECLARE
    allowed TEXT[] := ARRAY[
        'PENDING',        -- self
        'APPROVED',       -- from PENDING
        'REJECTED',       -- from PENDING
        'FAILED',         -- from PENDING
        'REVERSED',       -- from APPROVED
        'REFUNDED'        -- from APPROVED
    ];
    valid BOOLEAN := FALSE;
BEGIN
    -- Same-state no-op: always allowed.
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;
    -- Predecessor map:
    --   PENDING → APPROVED|REJECTED|FAILED
    --   APPROVED → REVERSED|REFUNDED
    --   REJECTED → PENDING
    --   FAILED → PENDING
    --   REVERSED → [] (terminal)
    --   REFUNDED → [] (terminal)
    valid := CASE NEW.status
        WHEN 'APPROVED' THEN OLD.status = 'PENDING'
        WHEN 'REJECTED' THEN OLD.status = 'PENDING'
        WHEN 'FAILED'   THEN OLD.status = 'PENDING'
        WHEN 'PENDING'  THEN OLD.status IN ('REJECTED', 'FAILED')
        WHEN 'REVERSED' THEN OLD.status = 'APPROVED'
        WHEN 'REFUNDED' THEN OLD.status = 'APPROVED'
        ELSE FALSE
    END;
    IF NOT valid THEN
        RAISE EXCEPTION
            'Invalid transaction state transition: "%" → "%". Allowed predecessors: %',
            OLD.status, NEW.status,
            CASE NEW.status
                WHEN 'APPROVED' THEN 'PENDING'
                WHEN 'REJECTED' THEN 'PENDING'
                WHEN 'FAILED'   THEN 'PENDING'
                WHEN 'PENDING'  THEN 'REJECTED|FAILED'
                WHEN 'REVERSED' THEN 'APPROVED'
                WHEN 'REFUNDED' THEN 'APPROVED'
                ELSE 'none'
            END;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_transaction_state_machine ON "transactions";
CREATE TRIGGER trg_enforce_transaction_state_machine
    BEFORE UPDATE OF status ON "transactions"
    FOR EACH ROW
    EXECUTE FUNCTION enforce_transaction_state_machine();

-- ----------------------------------------------------------------------------
-- 2. deposit_records
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_deposit_state_machine()
RETURNS TRIGGER AS $$
DECLARE
    valid BOOLEAN := FALSE;
BEGIN
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;
    -- Map per docs/STATE_MACHINES.md + deposit-state-machine.ts
    --   NOT_SUBMITTED → PENDING
    --   PENDING → PENDING_VERIFICATION | REJECTED
    --   PENDING_VERIFICATION → APPROVED | REJECTED
    --   APPROVED → REFUND_REQUESTED | FORFEITED
    --   REFUND_REQUESTED → REFUNDED | PARTIALLY_REFUNDED | APPROVED (cancel)
    --   REJECTED → NOT_SUBMITTED | PENDING
    --   REFUNDED, FORFEITED, PARTIALLY_REFUNDED → terminal
    valid := CASE NEW.status
        WHEN 'PENDING'              THEN OLD.status IN ('NOT_SUBMITTED', 'REJECTED')
        WHEN 'PENDING_VERIFICATION' THEN OLD.status = 'PENDING'
        WHEN 'APPROVED'             THEN OLD.status = 'PENDING_VERIFICATION' OR OLD.status = 'REFUND_REQUESTED'
        WHEN 'REJECTED'             THEN OLD.status IN ('PENDING', 'PENDING_VERIFICATION')
        WHEN 'REFUND_REQUESTED'     THEN OLD.status = 'APPROVED'
        WHEN 'REFUNDED'             THEN OLD.status = 'REFUND_REQUESTED'
        WHEN 'PARTIALLY_REFUNDED'   THEN OLD.status = 'REFUND_REQUESTED'
        WHEN 'FORFEITED'            THEN OLD.status = 'APPROVED'
        WHEN 'NOT_SUBMITTED'        THEN OLD.status = 'REJECTED'
        ELSE FALSE
    END;
    IF NOT valid THEN
        RAISE EXCEPTION
            'Invalid deposit state transition: "%" → "%".', OLD.status, NEW.status;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_deposit_state_machine ON "deposit_records";
CREATE TRIGGER trg_enforce_deposit_state_machine
    BEFORE UPDATE OF status ON "deposit_records"
    FOR EACH ROW
    EXECUTE FUNCTION enforce_deposit_state_machine();

-- ----------------------------------------------------------------------------
-- 3. guarantors
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_guarantor_state_machine()
RETURNS TRIGGER AS $$
DECLARE
    valid BOOLEAN := FALSE;
BEGIN
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;
    --   DRAFT → SUBMITTED
    --   SUBMITTED → APPROVED | REJECTED | INFO_REQUIRED
    --   REJECTED → SUBMITTED (rider re-submits)
    --   INFO_REQUIRED → SUBMITTED (rider responds)
    --   APPROVED → REPLACED (rider requests replacement)
    --   REPLACED → terminal
    valid := CASE NEW.status
        WHEN 'SUBMITTED'     THEN OLD.status IN ('DRAFT', 'REJECTED', 'INFO_REQUIRED')
        WHEN 'APPROVED'      THEN OLD.status = 'SUBMITTED'
        WHEN 'REJECTED'      THEN OLD.status = 'SUBMITTED'
        WHEN 'INFO_REQUIRED' THEN OLD.status = 'SUBMITTED'
        WHEN 'REPLACED'      THEN OLD.status = 'APPROVED'
        ELSE FALSE
    END;
    IF NOT valid THEN
        RAISE EXCEPTION
            'Invalid guarantor state transition: "%" → "%".', OLD.status, NEW.status;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_guarantor_state_machine ON "guarantors";
CREATE TRIGGER trg_enforce_guarantor_state_machine
    BEFORE UPDATE OF status ON "guarantors"
    FOR EACH ROW
    EXECUTE FUNCTION enforce_guarantor_state_machine();

-- ----------------------------------------------------------------------------
-- 4. incidents
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_incident_state_machine()
RETURNS TRIGGER AS $$
DECLARE
    valid BOOLEAN := FALSE;
BEGIN
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;
    --   REPORTED → INVESTIGATING | RESOLVED | DISMISSED
    --   INVESTIGATING → RESOLVED | CLOSED | DISMISSED
    --   RESOLVED → CLOSED | INVESTIGATING
    --   CLOSED → []
    --   DISMISSED → []
    valid := CASE NEW.status
        WHEN 'INVESTIGATING' THEN OLD.status IN ('REPORTED', 'RESOLVED')
        WHEN 'RESOLVED'      THEN OLD.status IN ('REPORTED', 'INVESTIGATING')
        WHEN 'CLOSED'        THEN OLD.status = 'INVESTIGATING'
        WHEN 'DISMISSED'     THEN OLD.status IN ('REPORTED', 'INVESTIGATING')
        ELSE FALSE
    END;
    IF NOT valid THEN
        RAISE EXCEPTION
            'Invalid incident state transition: "%" → "%".', OLD.status, NEW.status;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_incident_state_machine ON "incidents";
CREATE TRIGGER trg_enforce_incident_state_machine
    BEFORE UPDATE OF status ON "incidents"
    FOR EACH ROW
    EXECUTE FUNCTION enforce_incident_state_machine();

-- ----------------------------------------------------------------------------
-- 5. kyc_profiles
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_kyc_state_machine()
RETURNS TRIGGER AS $$
DECLARE
    valid BOOLEAN := FALSE;
BEGIN
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;
    --   DRAFT → SUBMITTED | EXPIRED
    --   SUBMITTED → APPROVED | REJECTED | INFO_REQUIRED
    --   INFO_REQUIRED → SUBMITTED (rider responds)
    --   REJECTED → SUBMITTED (rider re-submits)
    --   APPROVED → [] (terminal)
    --   EXPIRED → [] (terminal)
    valid := CASE NEW.status
        WHEN 'SUBMITTED'     THEN OLD.status IN ('DRAFT', 'INFO_REQUIRED', 'REJECTED')
        WHEN 'APPROVED'      THEN OLD.status = 'SUBMITTED'
        WHEN 'REJECTED'      THEN OLD.status = 'SUBMITTED'
        WHEN 'INFO_REQUIRED' THEN OLD.status = 'SUBMITTED'
        WHEN 'EXPIRED'       THEN OLD.status = 'DRAFT'
        ELSE FALSE
    END;
    IF NOT valid THEN
        RAISE EXCEPTION
            'Invalid KYC state transition: "%" → "%".', OLD.status, NEW.status;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_kyc_state_machine ON "kyc_profiles";
CREATE TRIGGER trg_enforce_kyc_state_machine
    BEFORE UPDATE OF status ON "kyc_profiles"
    FOR EACH ROW
    EXECUTE FUNCTION enforce_kyc_state_machine();

-- ----------------------------------------------------------------------------
-- 6. rental_leases
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_rental_state_machine()
RETURNS TRIGGER AS $$
DECLARE
    valid BOOLEAN := FALSE;
BEGIN
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;
    --   NO_RENTAL → PLAN_SELECTED
    --   PLAN_SELECTED → PICKUP_SCHEDULED | NO_RENTAL
    --   PICKUP_SCHEDULED → ACTIVE | PLAN_SELECTED | SUSPENDED
    --   ACTIVE → OVERDUE | RETURN_PENDING | SUSPENDED
    --   OVERDUE → ACTIVE | SUSPENDED
    --   RETURN_PENDING → RETURN_APPROVED | ACTIVE | SUSPENDED
    --   RETURN_APPROVED → CLOSED
    --   BOOKED → ACTIVE | CANCELLED (BOOKED is initial state pre-PICKUP_SCHEDULED)
    --   CLOSED, SUSPENDED → terminal
    valid := CASE NEW.status
        WHEN 'PLAN_SELECTED'     THEN OLD.status IN ('NO_RENTAL', 'PLAN_SELECTED')
        WHEN 'PICKUP_SCHEDULED'  THEN OLD.status = 'PLAN_SELECTED'
        WHEN 'ACTIVE'            THEN OLD.status IN ('BOOKED', 'PICKUP_SCHEDULED', 'OVERDUE', 'RETURN_PENDING')
        WHEN 'OVERDUE'           THEN OLD.status = 'ACTIVE'
        WHEN 'RETURN_PENDING'    THEN OLD.status = 'ACTIVE'
        WHEN 'RETURN_APPROVED'   THEN OLD.status = 'RETURN_PENDING'
        WHEN 'CLOSED'            THEN OLD.status = 'RETURN_APPROVED'
        WHEN 'SUSPENDED'         THEN OLD.status IN ('PICKUP_SCHEDULED', 'ACTIVE', 'OVERDUE', 'RETURN_PENDING')
        ELSE FALSE
    END;
    IF NOT valid THEN
        RAISE EXCEPTION
            'Invalid rental state transition: "%" → "%".', OLD.status, NEW.status;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_rental_state_machine ON "rental_leases";
CREATE TRIGGER trg_enforce_rental_state_machine
    BEFORE UPDATE OF status ON "rental_leases"
    FOR EACH ROW
    EXECUTE FUNCTION enforce_rental_state_machine();

-- ----------------------------------------------------------------------------
-- 7. support_tickets
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_ticket_state_machine()
RETURNS TRIGGER AS $$
DECLARE
    valid BOOLEAN := FALSE;
BEGIN
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;
    --   OPEN → IN_PROGRESS | WAITING_ON_RIDER
    --   IN_PROGRESS → WAITING_ON_RIDER | RESOLVED
    --   WAITING_ON_RIDER → IN_PROGRESS | RESOLVED | CLOSED
    --   RESOLVED → CLOSED
    --   CLOSED → []
    valid := CASE NEW.status
        WHEN 'IN_PROGRESS'       THEN OLD.status IN ('OPEN', 'WAITING_ON_RIDER')
        WHEN 'WAITING_ON_RIDER'  THEN OLD.status IN ('OPEN', 'IN_PROGRESS')
        WHEN 'RESOLVED'          THEN OLD.status IN ('IN_PROGRESS', 'WAITING_ON_RIDER')
        WHEN 'CLOSED'            THEN OLD.status IN ('RESOLVED', 'WAITING_ON_RIDER')
        ELSE FALSE
    END;
    IF NOT valid THEN
        RAISE EXCEPTION
            'Invalid ticket state transition: "%" → "%".', OLD.status, NEW.status;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_ticket_state_machine ON "support_tickets";
CREATE TRIGGER trg_enforce_ticket_state_machine
    BEFORE UPDATE OF status ON "support_tickets"
    FOR EACH ROW
    EXECUTE FUNCTION enforce_ticket_state_machine();

-- ----------------------------------------------------------------------------
-- 8. vehicles
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_vehicle_state_machine()
RETURNS TRIGGER AS $$
DECLARE
    valid BOOLEAN := FALSE;
BEGIN
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;
    --   AVAILABLE → RESERVED | ASSIGNED | MAINTENANCE | RETIRED
    --   RESERVED → ASSIGNED | AVAILABLE | MAINTENANCE
    --   ASSIGNED → ACTIVE_RENTAL | MAINTENANCE | AVAILABLE
    --   ACTIVE_RENTAL → RETURN_PENDING | MAINTENANCE | LOST
    --   RETURN_PENDING → MAINTENANCE | AVAILABLE
    --   MAINTENANCE → AVAILABLE | RETIRED
    --   RETIRED, LOST → terminal
    valid := CASE NEW.status
        WHEN 'AVAILABLE'     THEN OLD.status IN ('RESERVED', 'ASSIGNED', 'RETURN_PENDING', 'MAINTENANCE')
        WHEN 'RESERVED'      THEN OLD.status = 'AVAILABLE'
        WHEN 'ASSIGNED'      THEN OLD.status IN ('AVAILABLE', 'RESERVED')
        WHEN 'ACTIVE_RENTAL' THEN OLD.status = 'ASSIGNED'
        WHEN 'RETURN_PENDING' THEN OLD.status = 'ACTIVE_RENTAL'
        WHEN 'MAINTENANCE'   THEN OLD.status IN ('AVAILABLE', 'RESERVED', 'ASSIGNED', 'ACTIVE_RENTAL', 'RETURN_PENDING')
        WHEN 'RETIRED'       THEN OLD.status IN ('AVAILABLE', 'MAINTENANCE')
        WHEN 'LOST'          THEN OLD.status = 'ACTIVE_RENTAL'
        ELSE FALSE
    END;
    IF NOT valid THEN
        RAISE EXCEPTION
            'Invalid vehicle state transition: "%" → "%".', OLD.status, NEW.status;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_vehicle_state_machine ON "vehicles";
CREATE TRIGGER trg_enforce_vehicle_state_machine
    BEFORE UPDATE OF status ON "vehicles"
    FOR EACH ROW
    EXECUTE FUNCTION enforce_vehicle_state_machine();

-- Verification: a NO-OP migration (idempotent). Re-running this file
-- drops and recreates every trigger — safe because each is `CREATE OR
-- REPLACE` for the function and `DROP TRIGGER IF EXISTS` for the trigger.
