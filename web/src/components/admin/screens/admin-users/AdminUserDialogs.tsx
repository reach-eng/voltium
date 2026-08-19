'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PERMISSION_DESCRIPTORS } from '@/lib/permissions';
import { AdminRole, ADMIN_ROLE_LABELS } from '@/server/modules/admin/admin.types';
import type { AdminForm } from './types';

interface AdminUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId: string | null;
  form: AdminForm;
  setForm: (form: AdminForm | ((prev: AdminForm) => AdminForm)) => void;
  onRoleChange: (role: string) => void;
  onTogglePermission: (key: string) => void;
  onSave: () => void;
}

export function AdminUserDialog({
  open,
  onOpenChange,
  editingId,
  form,
  setForm,
  onRoleChange,
  onTogglePermission,
  onSave,
}: AdminUserDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{editingId ? 'Edit Admin & Permissions' : 'Add New Admin'}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Full Name"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="admin@voltium.in"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Role Preset</Label>
                <Select value={form.role} onValueChange={onRoleChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(AdminRole).map((role) => (
                      <SelectItem key={role} value={role}>
                        {ADMIN_ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!editingId && (
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={form.password || ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                    placeholder="Min 8 characters"
                  />
                </div>
              )}
            </div>

            {/* Granular Permission Checklist */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Granular Permissions</Label>
                <span className="text-xs text-muted-foreground">
                  {form.permissions.length} selected
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 border rounded-xl p-3 bg-muted/20">
                {PERMISSION_DESCRIPTORS.map((desc) => {
                  const isChecked = form.permissions.includes(desc.key);
                  return (
                    <label
                      key={desc.key}
                      className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => onTogglePermission(desc.key)}
                        className="mt-0.5"
                      />
                      <div className="space-y-0.5">
                        <div className="text-xs font-semibold leading-none">{desc.label}</div>
                        <div className="text-[10px] text-muted-foreground leading-tight">
                          Category: {desc.category}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={!form.name || !form.email || (!editingId && !form.password)}
          >
            {editingId ? 'Save Changes' : 'Create Admin'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
