'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ActiveRentalsTable } from './rental/ActiveRentalsTable';
import { PendingReturnsSection } from './rental/PendingReturnsSection';
import { PlanFormDialog } from './rental/PlanFormDialog';
import { RentalPlansGrid } from './rental/RentalPlansGrid';
import { ReturnReviewDialog } from './rental/ReturnReviewDialog';
import { useRentals } from './rental/useRentals';
import { riderDisplayName, type PlanFormState } from './rental/types';

/**
 * R3.7y shell — composes the Rental Management screen from the
 * rental/ subdirectory. Data + side effects live in `useRentals`;
 * the two small confirm dialogs (delete + approve) stay inline.
 */
export default function RentalManagement() {
  const r = useRentals();

  const updateForm = (updater: (prev: PlanFormState) => PlanFormState) => {
    r.setForm((prev) => updater(prev));
  };

  return (
    <div className="space-y-8">
      <PendingReturnsSection
        pendingReturns={r.pendingReturns}
        saving={r.saving}
        pendingApproveId={r.confirmApprove?.id ?? null}
        onReview={(rental) => r.setSelectedReturn(rental)}
        onApprove={(rental) => r.setConfirmApprove(rental)}
      />

      <RentalPlansGrid
        plans={r.plans}
        filteredPlans={r.filteredPlans}
        loading={r.loading}
        planSearch={r.planSearch}
        onPlanSearchChange={r.setPlanSearch}
        toggleLoading={r.toggleLoading}
        onAddPlan={r.openCreate}
        onEdit={r.openEdit}
        onDelete={(id) => r.setDeletePlanId(id)}
        onToggleActive={(plan) => {
          void r.togglePlanActive(plan);
        }}
      />

      <ActiveRentalsTable
        activeRentals={r.activeRentals}
        filteredRentals={r.filteredRentals}
        plans={r.plans}
        rentalSearch={r.rentalSearch}
        rentalFilter={r.rentalFilter}
        onSearchChange={r.setRentalSearch}
        onFilterChange={r.setRentalFilter}
        onClearFilters={() => {
          r.setRentalSearch('');
          r.setRentalFilter('ALL');
        }}
      />

      <PlanFormDialog
        open={r.planDialogOpen}
        onOpenChange={(open) => {
          if (!open) r.closePlanDialog();
        }}
        editing={!!r.editingPlan}
        form={r.form}
        onFormChange={updateForm}
        saving={r.saving}
        onSubmit={() => {
          void r.handleSavePlan();
        }}
      />

      <ReturnReviewDialog
        rental={r.selectedReturn}
        onClose={() => r.setSelectedReturn(null)}
        saving={r.saving}
        onApprove={(rental) => r.setConfirmApprove(rental)}
      />

      {/* Delete Plan Confirmation */}
      <AlertDialog
        open={!!r.deletePlanId}
        onOpenChange={(o) => {
          if (!o) r.setDeletePlanId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rental Plan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this plan? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void r.handleDeletePlan();
              }}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approve Return Confirmation */}
      <AlertDialog
        open={!!r.confirmApprove}
        onOpenChange={(o) => {
          if (!o) r.setConfirmApprove(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Return</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark{' '}
              {r.confirmApprove
                ? riderDisplayName(r.confirmApprove)
                : 'the rider'}
              &apos;s rental as returned. The rider will no longer have an
              active rental.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (r.confirmApprove) void r.handleApproveReturn(r.confirmApprove.id);
              }}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Approve Return
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
