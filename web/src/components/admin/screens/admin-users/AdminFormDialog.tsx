'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PERMISSION_DESCRIPTORS } from '@/lib/permissions';
import {
  ADMIN_ROLE_OPTIONS,
  PERMISSION_CATEGORIES,
  type AdminForm,
} from './types';

interface AdminFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEdit: boolean;
  form: AdminForm;
  setForm: (form: AdminForm) => void;
  onSave: () => void;
  onRoleChange: (role: string) => void;
  onTogglePermission: (key: string) => void;
}

/**
 * R3 split (AdminUserManagement) — add/edit dialog.
 *
 * Top section: name, email, password (optional on edit), role.
 * Bottom section: 6-category grid of permission checkboxes, with a
 * "Reset to Role Defaults" link at the top. The dialog is sized
 * to 2xl and scrolls internally so the permission grid doesn't
 * push the Save button off-screen.
 */
export function AdminFormDialog({
  open,
  onOpenChange,
  isEdit,
  form,
  setForm,
  onSave,
  onRoleChange,
  onTogglePermission,
}: AdminFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Admin' : 'Add New Admin'}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 pr-4 -mr-4 overflow-y-auto min-h-0">
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Full name"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="admin@voltium.in"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isEdit ? 'New Password (Optional)' : 'Password'}</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={isEdit ? 'Leave blank to keep same' : 'Initial password'}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={onRoleChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ADMIN_ROLE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-bold">Granular Permissions</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRoleChange(form.role)}
                  className="text-[10px] h-7 text-primary"
                >
                  Reset to Role Defaults
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 border rounded-xl p-4 bg-muted/30">
                {PERMISSION_CATEGORIES.map((category) => (
                  <div key={category} className="space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground border-b pb-1">
                      {category}
                    </h4>
                    <div className="space-y-2">
                      {PERMISSION_DESCRIPTORS.filter((p) => p.category === category).map((p) => (
                        <div key={p.key} className="flex items-center space-x-2">
                          <Checkbox
                            id={`perm-${p.key}`}
                            checked={form.permissions.includes(p.key)}
                            onCheckedChange={() => onTogglePermission(p.key)}
                          />
                          <Label
                            htmlFor={`perm-${p.key}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {p.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-4 border-t mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={!form.name || !form.email || (!isEdit && !form.password)}
          >
            {isEdit ? 'Save Changes' : 'Create Admin'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
