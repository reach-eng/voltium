'use client';

import { CalendarDays, Clock, Edit, IndianRupee, Plus, Search, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { PLAN_TYPE_BADGE_CLASS, type RentalPlan } from './types';

interface RentalPlansGridProps {
  plans: RentalPlan[];
  filteredPlans: RentalPlan[];
  loading: boolean;
  planSearch: string;
  onPlanSearchChange: (v: string) => void;
  toggleLoading: string | null;
  onAddPlan: () => void;
  onEdit: (plan: RentalPlan) => void;
  onDelete: (planId: string) => void;
  onToggleActive: (plan: RentalPlan) => void;
}

/**
 * R3.7y split — search + plan cards grid for the Rental Plans section.
 */
export function RentalPlansGrid({
  plans,
  filteredPlans,
  loading,
  planSearch,
  onPlanSearchChange,
  toggleLoading,
  onAddPlan,
  onEdit,
  onDelete,
  onToggleActive,
}: RentalPlansGridProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-foreground">Rental Plans</h2>
        <Button size="sm" onClick={onAddPlan}>
          <Plus className="w-4 h-4 mr-2" />
          Add Plan
        </Button>
      </div>

      {plans.length > 0 && (
        <div className="relative max-w-sm mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search plans..."
            value={planSearch}
            onChange={(e) => onPlanSearchChange(e.target.value)}
            className="pl-10 h-9 rounded-xl border-muted-foreground/20 text-sm"
          />
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <Card className="rounded-xl shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <CalendarDays className="w-12 h-12 mb-3 opacity-40" />
            <p className="text-sm">No rental plans configured</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlans.map((plan) => (
            <Card key={plan.id} className="rounded-xl shadow-sm">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3
                      className={`font-semibold text-foreground ${
                        !plan.isActive ? 'opacity-50' : ''
                      }`}
                    >
                      {plan.name}
                    </h3>
                    <Badge
                      variant="outline"
                      className={`text-xs mt-1 ${PLAN_TYPE_BADGE_CLASS[plan.type] || ''}`}
                    >
                      {plan.type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-500"
                      aria-label="Delete plan"
                      onClick={() => onDelete(plan.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <Switch
                      checked={plan.isActive}
                      disabled={toggleLoading === plan.id}
                      onCheckedChange={() => onToggleActive(plan)}
                    />
                  </div>
                </div>

                <div className="flex items-baseline gap-1">
                  <IndianRupee className="w-5 h-5 text-muted-foreground" />
                  <span className="text-3xl font-bold text-foreground">
                    {plan.price.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>
                    {plan.durationDays} day{plan.durationDays !== 1 ? 's' : ''}
                  </span>
                </div>

                {plan.description && (
                  <p className="text-xs text-muted-foreground">{plan.description}</p>
                )}

                <div className="pt-2 mt-2 border-t border-border/40 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Security Deposit:</span>
                    <span className="font-medium text-foreground">
                      ₹{plan.securityDeposit?.toLocaleString('en-IN') ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Refundable:</span>
                    <span className="font-medium text-foreground">
                      {plan.isSecurityRefundable
                        ? `Yes${
                            plan.refundableAfterDays
                              ? ` (after ${plan.refundableAfterDays} days)`
                              : ''
                          }`
                        : 'No'}
                    </span>
                  </div>
                  {plan.additionalInfo && (
                    <div className="text-xs mt-2 text-muted-foreground italic">
                      &quot;{plan.additionalInfo}&quot;
                    </div>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => onEdit(plan)}
                >
                  <Edit className="w-3 h-3 mr-1" />
                  Edit Plan
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
