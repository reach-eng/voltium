/**
 * R3.7g split — Shift types & form state.
 *
 * Shift + ShiftPart were inlined inside ShiftManagement.tsx. Extracted
 * so the data hook, form dialog, and card renderer can all share the
 * same view of a shift.
 */

export interface ShiftPart {
  startTime: string;
  endTime: string;
}

export interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  parts?: ShiftPart[];
  maxBookings: number;
  isActive: boolean;
  createdAt: string;
  _count?: { leases: number };
}

export interface ShiftForm {
  name: string;
  parts: ShiftPart[];
  maxBookings: number;
  isActive: boolean;
}

export const EMPTY_SHIFT_FORM: ShiftForm = {
  name: '',
  parts: [{ startTime: '', endTime: '' }],
  maxBookings: 5,
  isActive: true,
};
