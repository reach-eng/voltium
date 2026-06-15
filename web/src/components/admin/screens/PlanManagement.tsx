'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Plus, Edit, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface RentalPlan {
  id: string;
  name: string;
  type: string;
  price: number;
  durationDays: number;
  isActive: boolean;
  description: string;
}

export default function PlanManagement() {
  const [plans, setPlans] = useState<RentalPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Simulate fetching plans
    setTimeout(() => {
      setPlans([
        {
          id: 'p-1',
          name: 'Daily Flex',
          type: 'DAILY',
          price: 299,
          durationDays: 1,
          isActive: true,
          description: 'Perfect for short-term daily delivery agents.',
        },
        {
          id: 'p-2',
          name: 'Weekly Value',
          type: 'WEEKLY',
          price: 1499,
          durationDays: 7,
          isActive: true,
          description: 'Weekly subscription with lower overall daily rates.',
        },
        {
          id: 'p-3',
          name: 'Monthly Professional',
          type: 'MONTHLY',
          price: 4999,
          durationDays: 30,
          isActive: true,
          description: 'Best long-term pricing for full-time fleet drivers.',
        }
      ]);
      setLoading(false);
    }, 500);
  }, []);

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    setPlans((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isActive: !currentStatus } : p))
    );
    toast.success(`Plan ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
  };

  const filteredPlans = plans.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Plans & Pricing</h2>
          <p className="text-muted-foreground">Configure rental subscription plans and security deposit amounts.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search plans..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button className="bg-primary text-white gap-2">
            <Plus className="h-4 w-4" /> Create Plan
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-8 text-center text-muted-foreground">Loading plans...</div>
        ) : filteredPlans.length === 0 ? (
          <div className="col-span-full py-8 text-center text-muted-foreground">No plans found.</div>
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
                  ₹{plan.price} <span className="text-xs font-normal text-muted-foreground">/ {plan.durationDays} day(s)</span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 h-10">
                  {plan.description}
                </p>
                <div className="flex gap-2 pt-2 border-t">
                  <Button variant="outline" size="sm" className="flex-1">
                    <Edit className="h-4 w-4 mr-2" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleToggleActive(plan.id, plan.isActive)}
                  >
                    {plan.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
