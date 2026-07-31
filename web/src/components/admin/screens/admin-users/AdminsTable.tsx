'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChevronLeft, ChevronRight, Shield, UserCog } from 'lucide-react';
import { formatDateDDMMYYYY } from '@/lib/date-utils';
import { ADMIN_PAGE_SIZE, ADMIN_ROLE_COLORS, ADMIN_ROLE_FALLBACK, type Admin } from './types';

interface AdminsTableProps {
  loading: boolean;
  admins: Admin[];
  search: string;
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  onEdit: (admin: Admin) => void;
  onToggleActive: (admin: Admin) => void;
}

/**
 * R3 split (AdminUserManagement) — admins table + pagination.
 *
 * Seven columns: Name (with role icon), Email, Role (colored badge),
 * Status (active/inactive badge), Last Login, Created, Actions
 * (edit + activate/deactivate). Loading state shows a centred
 * spinner; empty state shows a filter-aware message. Pagination
 * only renders when there are multiple pages.
 */
export function AdminsTable({
  loading,
  admins,
  search,
  page,
  totalPages,
  total,
  onPageChange,
  onEdit,
  onToggleActive,
}: AdminsTableProps) {
  return (
    <>
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
                      className={`text-[10px] font-bold ${ADMIN_ROLE_COLORS[a.role] || ADMIN_ROLE_FALLBACK}`}
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

      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between bg-card px-4 py-3 rounded-xl border border-border/50 shadow-sm">
          <div className="text-sm text-muted-foreground hidden sm:block">
            Showing <span className="font-medium">{(page - 1) * ADMIN_PAGE_SIZE + 1}</span> to{' '}
            <span className="font-medium">{Math.min(page * ADMIN_PAGE_SIZE, total)}</span> of{' '}
            <span className="font-medium">{total}</span> Admins
          </div>
          <div className="flex items-center gap-2 mx-auto sm:mx-0">
            <Button
              variant="outline"
              size="icon"
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page === 1}
              className="h-10 w-10 rounded-lg"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium px-2">
              Page {page} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="h-10 w-10 rounded-lg"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
