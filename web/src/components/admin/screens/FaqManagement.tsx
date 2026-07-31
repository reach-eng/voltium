'use client';

import { useFaqs } from './faqs/useFaqs';
import { FaqHeader } from './faqs/FaqHeader';
import { FaqFiltersBar } from './faqs/FaqFiltersBar';
import { FaqList } from './faqs/FaqList';
import { FaqPagination } from './faqs/FaqPagination';
import { FaqFormDialog } from './faqs/FaqFormDialog';
import { DeleteFaqDialog } from './faqs/DeleteFaqDialog';

/**
 * R3.7n split — FAQ management shell.
 *
 * Pre-split: 18 KB / 525 lines with 11 useState + 5 fetch handlers
 * + form + dialogs + list inline. Post-split: thin orchestrator that
 * wires the data hook and 6 subcomponents. State machine + all
 * network logic live in `useFaqs` (5.4 KB); the rest live in focused
 * files under `faqs/`.
 */
export default function FaqManagement() {
  const f = useFaqs();

  return (
    <div className="space-y-6">
      <FaqHeader onAddClick={() => f.openDialog()} />

      <FaqFiltersBar
        search={f.search}
        setSearch={f.setSearch}
        category={f.category}
        setCategory={f.setCategory}
        onPageReset={() => f.setPage(1)}
      />

      <FaqList
        loading={f.loading}
        faqs={f.faqs}
        search={f.search}
        category={f.category}
        page={f.page}
        totalPages={f.pagination.totalPages}
        expanded={f.expanded}
        setExpanded={f.setExpanded}
        onMoveUp={f.moveUp}
        onMoveDown={f.moveDown}
        onEdit={f.openDialog}
        onDelete={f.setDeleteTarget}
        onToggleActive={f.toggleActive}
        onClearFilters={() => {
          f.setSearch('');
          f.setCategory('all');
          f.setPage(1);
        }}
      />

      <FaqPagination page={f.page} pagination={f.pagination} onPageChange={f.setPage} />

      <FaqFormDialog
        open={f.dialogOpen}
        onOpenChange={f.setDialogOpen}
        isEdit={!!f.editFaq}
        form={f.form}
        setForm={f.setForm}
        onSave={f.saveFaq}
      />

      <DeleteFaqDialog
        deleteTarget={f.deleteTarget}
        onOpenChange={(open) => {
          if (!open) f.setDeleteTarget(null);
        }}
        onConfirm={f.confirmDeleteFaq}
      />
    </div>
  );
}
