'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Plus,
  ShieldAlert,
  Shield,
  UserCog,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { formatDateDDMMYYYY } from '@/lib/date-utils';
import type { Admin } from './types';

const roleColors: Record<string, string> = {
  SUPER_ADMIN: 'border-red-500/20 text-red-600 bg-red-500/5 dark:text-red-400',
  ADMIN: 'border-primary/20 text-primary bg-primary/5',
  MANAGER: 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400',
  FLEET_MANAGER: 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400',
  TEAM_LEADER: 'border-cyan-500/20 text-cyan-600 bg-cyan-500/5 dark:text-cyan-400',
};

interface AdminUserTableProps {
  loading: boolean;
  admins: Admin[];
  search: string;
  setSearch: (s: string) => void;
  page: number;
  setPage: (p: number | ((prev: number) => number)) => void;
  pagination: { total: number; totalPages: number };
  onAddClick: () => void;
  onEdit: (admin: Admin) => void;
  onToggleActive: (admin: Admin) => void;
}

export function AdminUserTable({
  loading,
  admins,
  search,
  setSearch,
  page,
  setPage,
  pagination,
  onAddClick,
  onEdit,
  onToggleActive,
}: AdminUserTableProps) {
  return (
    <div className="space-y-6">
      <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold text-red-600 dark:text-red-400 text-sm">Super Admin Only</p>
          <p className="text-xs text-red-500 dark:text-red-400/80 mt-0.5">
            This section is restricted to Super Admins only. Role changes and admin creation require
            SUPER_ADMIN privileges.
          </p>
        </div>
      </div>

      {/* Search + Add */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-10 h-11 rounded-xl border-muted-foreground/20 text-base shadow-sm"
          />
          {search && (
            <button
              onClick={() => {
                setSearch('');
                setPage(1);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button onClick={onAddClick} className="rounded-xl h-11 px-5">
          <Plus className="h-5 w-5 mr-1.5" /> Add New Admin
        </Button>
      </div>

      {/* Admins Table */}
      <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                  Loading admins...
                </TableCell>
              </TableRow>
            ) : admins.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  {search ? 'No admins match your search' : 'No admins found'}
                </TableCell>
              </TableRow>
            ) : (
              admins.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {a.role === 'SUPER_ADMIN' ? (
                        <Shield className="h-4 w-4 text-red-500" />
                      ) : (
                        <UserCog className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className={!a.isActive ? 'opacity-50' : ''}>{a.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{a.email}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold ${roleColors[a.role] || 'border-slate-500/20 text-slate-600 bg-slate-500/5'}`}
                    >
                      {a.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold ${
                        a.isActive
                          ? 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400'
                          : 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400'
                      }`}
                    >
                      {a.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {a.lastLoginAt ? formatDateDDMMYYYY(a.lastLoginAt) : 'Never'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDateDDMMYYYY(a.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10"
                        onClick={() => onEdit(a)}
                      >
                        <UserCog className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={a.isActive ? 'outline' : 'default'}
                        size="sm"
                        className="text-sm h-10 px-3"
                        onClick={() => onToggleActive(a)}
                      >
                        {a.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {!loading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between bg-card px-4 py-3 rounded-xl border border-border/50 shadow-sm">
          <div className="text-sm text-muted-foreground hidden sm:block">
            Page {page} of {pagination.totalPages} ({pagination.total} total admins)
          </div>
          <div className="flex items-center gap-2 mx-auto sm:mx-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-9 gap-1"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <span className="text-sm font-medium px-2">
              {page} / {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              className="h-9 gap-1"
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
