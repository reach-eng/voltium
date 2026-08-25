import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children, open }: any) => (open ? <div data-slot="alert-dialog">{children}</div> : null),
  AlertDialogContent: ({ children, className }: any) => <div className={className}>{children}</div>,
  AlertDialogHeader: ({ children, className }: any) => <div className={className}>{children}</div>,
  AlertDialogTitle: ({ children, className }: any) => <h2 className={className}>{children}</h2>,
  AlertDialogDescription: ({ children, className, asChild }: any) => <div className={className}>{children}</div>,
  AlertDialogFooter: ({ children, className }: any) => <div className={className}>{children}</div>,
  AlertDialogCancel: ({ children, className, onClick }: any) => <button className={className} onClick={onClick}>{children}</button>,
}));

import { DestructiveConfirm } from '@/components/admin/DestructiveConfirm';
import { MaintenanceToggleButton } from '@/components/admin/MaintenanceToggleButton';

describe('DestructiveConfirm (F-001, F-002, F-005, F-006)', () => {
  it('renders destructive confirm dialog when open=true', () => {
    const html = renderToStaticMarkup(
      <DestructiveConfirm
        open={true}
        onOpenChange={vi.fn()}
        title="Delete Item"
        description="Are you sure you want to delete this item?"
        expectedPhrase="DELETE"
        onConfirm={vi.fn()}
      />
    );
    expect(html).toContain('Delete Item');
    expect(html).toContain('DELETE');
    expect(html).toContain('To proceed, type');
  });

  it('renders with custom labels and phrases', () => {
    const html = renderToStaticMarkup(
      <DestructiveConfirm
        open={true}
        onOpenChange={vi.fn()}
        title="Restore System"
        description="Overwriting database state"
        expectedPhrase="VERIFY ALL"
        confirmLabel="Execute Restore"
        cancelLabel="Abort"
        onConfirm={vi.fn()}
      />
    );
    expect(html).toContain('Restore System');
    expect(html).toContain('VERIFY ALL');
    expect(html).toContain('Execute Restore');
    expect(html).toContain('Abort');
  });
});

describe('MaintenanceToggleButton (F-001)', () => {
  it('renders Enable Maintenance when enabled=false', () => {
    const html = renderToStaticMarkup(
      <MaintenanceToggleButton
        enabled={false}
        onToggle={vi.fn()}
      />
    );
    expect(html).toContain('Enable Maintenance');
  });

  it('renders Disable Maintenance when enabled=true', () => {
    const html = renderToStaticMarkup(
      <MaintenanceToggleButton
        enabled={true}
        onToggle={vi.fn()}
      />
    );
    expect(html).toContain('Disable Maintenance');
  });
});
