'use client';

import { useEffect, useState } from 'react';
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
import { TeamLeaderBulkBar } from './team-leaders/TeamLeaderBulkBar';
import { TeamLeaderFiltersBar } from './team-leaders/TeamLeaderFiltersBar';
import { TeamLeaderFormDialog } from './team-leaders/TeamLeaderFormDialog';
import { TeamLeaderHeader } from './team-leaders/TeamLeaderHeader';
import { TeamLeaderPagination } from './team-leaders/TeamLeaderPagination';
import { TeamLeaderStatsDialog } from './team-leaders/TeamLeaderStatsDialog';
import { TeamLeadersGrid } from './team-leaders/TeamLeadersGrid';
import { UndoToast } from './team-leaders/UndoToast';
import { useTeamLeaders } from './team-leaders/useTeamLeaders';
import { useTeamLeaderKeyboard } from './team-leaders/useTeamLeaderKeyboard';
import type { TeamLeaderFormState } from './team-leaders/types';
import type { SessionPayload } from '@/lib/permissions';

/**
 * R3.7aa shell — composes the Team Leader Management screen from
 * the team-leaders/ subdirectory. All data lives in `useTeamLeaders`;
 * the two confirm dialogs (single + bulk delete) stay inline.
 */
export default function TeamLeaderManagement() {
  const t = useTeamLeaders();
  // ADMIN_TEAM_LEADERS_AUDIT_2026-08-24 P1-2: fetch the admin's
  // session once on mount so the bulk bar can hide mutation buttons
  // for admins without `team_leaders_manage`. Same pattern as
  // `AdminSidebar.tsx` / `AdminLayout.tsx`. The state defaults to
  // null so the bulk bar optimistically shows the buttons until the
  // session resolves — the server is the source of truth and will
  // 403 any unauthorised click.
  const [session, setSession] = useState<SessionPayload | null>(null);
  useEffect(() => {
    fetch('/api/admin/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.data) setSession(data.data);
      })
      .catch(() => {
        // non-critical — the server's permission check on each
        // bulk action call is the security boundary.
      });
  }, []);

  useTeamLeaderKeyboard({
    visibleIds: t.leaders.map((l) => l.id),
    onSelectAll: t.selectAll,
    canUndo: !!t.lastAction && !t.bulkLoading,
    onUndo: () => {
      void t.handleUndo();
    },
  });

  const updateForm = (updater: (prev: TeamLeaderFormState) => TeamLeaderFormState) => {
    t.setForm((prev) => updater(prev));
  };

  const hasFilter = !!t.search || t.activeFilter !== 'ALL';
  const selectedLeaders = t.leaders.filter((l) => t.selectedIds.has(l.id));

  return (
    <div className="space-y-6">
      <TeamLeaderHeader onAdd={t.openCreate} />

      <div className="flex flex-wrap items-center gap-3">
        <TeamLeaderFiltersBar
          search={t.search}
          onSearchChange={t.setSearch}
          activeFilter={t.activeFilter}
          onActiveFilterChange={t.setActiveFilter}
          onClear={() => {
            t.setSearch('');
            t.setActiveFilter('ALL');
            t.setPage(1);
          }}
        />
        <TeamLeaderBulkBar
          selectedCount={t.selectedIds.size}
          selectedLeaders={selectedLeaders}
          bulkLoading={t.bulkLoading}
          canUndo={!!t.lastAction}
          session={session}
          onActivate={() => {
            void t.handleBulkAction('activate');
          }}
          onDeactivate={() => {
            void t.handleBulkAction('deactivate');
          }}
          onDelete={() => t.setBulkDeleteTargets(Array.from(t.selectedIds))}
          onExport={() => {
            /* handled internally by bulk bar */
          }}
          onUndo={() => {
            void t.handleUndo();
          }}
          onClear={t.clearSelection}
        />
      </div>

      <TeamLeadersGrid
        leaders={t.leaders}
        selectedIds={t.selectedIds}
        toggleLoading={t.toggleLoading}
        loading={t.loading}
        hasFilter={hasFilter}
        onToggleSelect={t.toggleSelect}
        onToggleActive={(leader) => {
          void t.toggleActive(leader);
        }}
        onViewStats={(leader) => {
          void t.viewStats(leader);
        }}
        onEdit={t.openEdit}
        onDelete={(leader) => t.setDeleteTarget(leader.id)}
        onSelectAllVisible={(checked) => {
          if (checked) t.selectAll();
          else t.clearSelection();
        }}
      />

      <TeamLeaderPagination
        page={t.page}
        totalPages={t.totalPages}
        totalCount={t.totalCount}
        onPageChange={t.setPage}
      />

      <TeamLeaderFormDialog
        open={t.dialogOpen}
        onOpenChange={(open) => {
          if (!open) t.closeDialog();
        }}
        editing={!!t.editLeader}
        form={t.form}
        onFormChange={updateForm}
        saving={t.saving}
        error={t.error}
        onSubmit={() => {
          void t.saveLeader();
        }}
      />

      <TeamLeaderStatsDialog
        open={t.statsModalOpen}
        onOpenChange={t.setStatsModalOpen}
        loading={t.statsLoading}
        payload={t.selectedTlStats}
      />

      {/* Single Delete Confirmation */}
      <AlertDialog
        open={!!t.deleteTarget}
        onOpenChange={(open) => {
          if (!open) t.setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team Leader</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this team leader? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void t.confirmDeleteLeader();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog
        open={!!t.bulkDeleteTargets}
        onOpenChange={(open) => {
          if (!open) t.setBulkDeleteTargets(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {t.bulkDeleteTargets?.length || 0} Team Leaders
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {t.bulkDeleteTargets?.length || 0}{' '}
              team leader(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void t.confirmBulkDelete();
              }}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UndoToast
        visible={t.showUndoToast}
        count={t.lastAction?.ids.length || 0}
        busy={t.bulkLoading}
        onUndo={() => {
          void t.handleUndo();
        }}
      />
    </div>
  );
}
