'use client';

import { useShifts } from './shifts/useShifts';
import { ShiftHeader } from './shifts/ShiftHeader';
import { ShiftFiltersBar } from './shifts/ShiftFiltersBar';
import { ShiftsGrid } from './shifts/ShiftsGrid';
import { ShiftFormDialog } from './shifts/ShiftFormDialog';
import { DeleteShiftDialog } from './shifts/DeleteShiftDialog';

/**
 * R3.7g split — Shifts management shell.
 *
 * Pre-split: 17.4 KB / 514 lines with state + 5 handlers + 3 dialogs + grid all inline.
 * Post-split: thin orchestrator that wires the data hook and the 6
 * subcomponents. State machine + fetch logic live in `useShifts` (6.4 KB);
 * dialogs + card + filters each in their own file under `shifts/`.
 */
export default function ShiftManagement() {
  const s = useShifts();

  return (
    <div className="space-y-6">
      <ShiftHeader onAddClick={() => s.openDialog()} />

      <ShiftFiltersBar
        search={s.search}
        setSearch={s.setSearch}
        activeFilter={s.activeFilter}
        setActiveFilter={s.setActiveFilter}
      />

      <ShiftsGrid
        loading={s.loading}
        shifts={s.shifts}
        search={s.search}
        onToggle={s.toggleActive}
        onEdit={s.openDialog}
        onDelete={s.setDeleteTarget}
      />

      <ShiftFormDialog
        open={s.dialogOpen}
        onOpenChange={s.setDialogOpen}
        isEdit={!!s.editShift}
        form={s.form}
        setForm={s.setForm}
        error={s.error}
        saving={s.saving}
        onSave={s.saveShift}
        onUpdatePart={s.updatePart}
        onAddPart={s.addPart}
        onRemovePart={s.removePart}
      />

      <DeleteShiftDialog
        deleteTarget={s.deleteTarget}
        onOpenChange={(open) => {
          if (!open) s.setDeleteTarget(null);
        }}
        onConfirm={s.confirmDelete}
      />
    </div>
  );
}
