'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { extractErrorMessage } from '@/lib/error-utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Plus, Edit, Trash2, RefreshCw, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
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

interface RentalPlan {
  id: string;
  name: string;
  type: string;
  price: number;
  securityDeposit: number;
  durationDays: number;
  isActive: boolean;
  description: string;
}

export default function PlanManagement() {
  const [plans, setPlans] = useState<RentalPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [planToDelete, setPlanToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/plans');
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setPlans(json.data || []);
        }
      }
    } catch {
      // Silent fallback
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/admin/plans`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive: !currentStatus })
      });
      const json = await res.json();
      if (json.success) {
        setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, isActive: !currentStatus } : p)));
        toast.success(`Plan ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
      } else {
        toast.error(extractErrorMessage(json, ''));
      }
    } catch {
      toast.error('Failed to update plan status');
    }
  };

  const confirmDelete = async () => {
    if (!planToDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/plans`, { 
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: planToDelete.id })
      });
      const json = await res.json();
      if (json.success) {
        setPlans((prev) => prev.filter((p) => p.id !== planToDelete.id));
        toast.success('Plan deleted successfully');
        setPlanToDelete(null);
      } else {
        toast.error(extractErrorMessage(json, ''));
      }
    } catch {
      toast.error('Failed to delete plan');
    } finally {
      setDeleting(false);
    }
  };

  const filteredPlans = plans.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Plans & Pricing</h2>
          <p className="text-muted-foreground">
            Configure rental subscription plans and security deposit amounts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search plans..."
              className="pl-8 h-11 text-base rounded-xl"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button size="default" className="bg-primary text-white gap-2 h-11 px-5 rounded-xl">
            <Plus className="h-5 w-5" /> Create Plan
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
        {loading ? (
          <>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-2">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-8 w-full" />
                <div className="flex gap-2 pt-2 border-t">
                  <Skeleton className="h-8 flex-1 rounded-md" />
                  <Skeleton className="h-8 flex-1 rounded-md" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-2">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-8 w-full" />
                <div className="flex gap-2 pt-2 border-t">
                  <Skeleton className="h-8 flex-1 rounded-md" />
                  <Skeleton className="h-8 flex-1 rounded-md" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-2">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-8 w-full" />
                <div className="flex gap-2 pt-2 border-t">
                  <Skeleton className="h-8 flex-1 rounded-md" />
                  <Skeleton className="h-8 flex-1 rounded-md" />
                </div>
              </CardContent>
            </Card>
          </>
        ) : filteredPlans.length === 0 ? (
          <div className="col-span-full py-8 text-center text-muted-foreground">
            No plans found.
          </div>
        ) : (
          filteredPlans.map((plan) => (
            <Card key={plan.id} className={!plan.isActive ? 'opacity-60' : ''}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-bold">{plan.name}</CardTitle>
                <Badge variant={plan.isActive ? 'default' : 'secondary'}>
                  {plan.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4 pt-2">
                <div className="text-2xl font-black">
                  ₹{plan.price}{' '}
                  <span className="text-xs font-normal text-muted-foreground">
                    / {plan.durationDays} day(s)
                  </span>
                </div>
                <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                  Security Deposit: ₹{((plan.securityDeposit ?? (((plan as any).securityDepositInPaise || 0) / 100)) || 0).toLocaleString('en-IN')}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 h-10">
                  {plan.description}
                </p>
                <div className="flex gap-2 pt-2 border-t">
                  <Button variant="outline" size="default" className="flex-1 h-11">
                    <Edit className="h-5 w-5 mr-2" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="default"
                    className="flex-1 h-11"
                    onClick={() => handleToggleActive(plan.id, plan.isActive)}
                  >
                    {plan.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/15"
                    onClick={() => setPlanToDelete({ id: plan.id, name: plan.name })}
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!planToDelete} onOpenChange={() => setPlanToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rental Plan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>"{planToDelete?.name}"</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Deleting...
                </>
              ) : (
                'Delete Plan'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
