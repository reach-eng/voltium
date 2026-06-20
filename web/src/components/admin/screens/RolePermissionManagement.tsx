'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Key, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

export default function RolePermissionManagement() {
  const [selectedRole, setSelectedRole] = useState('SUPER_ADMIN');

  const roles = [
    { name: 'SUPER_ADMIN', count: 2 },
    { name: 'OPERATIONS_ADMIN', count: 3 },
    { name: 'KYC_REVIEWER', count: 4 },
    { name: 'FINANCE_ADMIN', count: 2 },
    { name: 'SUPPORT_AGENT', count: 5 },
    { name: 'HUB_MANAGER', count: 4 },
    { name: 'FLEET_MANAGER', count: 2 },
    { name: 'TEAM_LEADER', count: 8 },
    { name: 'READ_ONLY', count: 1 },
  ];

  const permissions = [
    { key: 'riders_view', label: 'View Riders', category: 'Riders' },
    { key: 'kyc_approve', label: 'Approve KYC', category: 'Riders' },
    { key: 'vehicles_view', label: 'View Vehicles', category: 'Vehicles' },
    { key: 'transactions_manage', label: 'Financial Management', category: 'Finance' },
    { key: 'tickets_resolve', label: 'Resolve Tickets', category: 'Support' },
    { key: 'settings_manage', label: 'System Settings', category: 'System' },
    { key: 'data_management_restore', label: 'Restore Backups', category: 'Data' },
  ];

  const handleSave = () => {
    toast.success('Permissions matrix saved successfully');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Roles & Permissions</h2>
          <p className="text-muted-foreground">
            Map system operations to roles instead of hardcoding validation rules.
          </p>
        </div>
        <Button className="bg-primary text-white" onClick={handleSave}>
          Save Permissions Matrix
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>System Roles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-3 pt-0">
            {roles.map((r) => (
              <button
                key={r.name}
                className={`w-full text-left p-3 rounded-lg text-xs font-semibold uppercase tracking-wider flex items-center justify-between transition-all ${
                  selectedRole === r.name
                    ? 'bg-primary/10 text-primary border-l-4 border-primary'
                    : 'hover:bg-muted/50 text-muted-foreground'
                }`}
                onClick={() => setSelectedRole(r.name)}
              >
                <span>{r.name.replace('_', ' ')}</span>
                <Badge variant="outline" className="text-[10px]">
                  {r.count}
                </Badge>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle className="text-base font-bold">
              Permissions Allowed for {selectedRole.replace('_', ' ')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedRole === 'SUPER_ADMIN' ? (
              <div className="flex items-center gap-3 p-4 border border-emerald-200 bg-emerald-500/5 text-emerald-950 text-xs rounded-xl">
                <Key className="h-5 w-5 text-emerald-600 shrink-0" />
                <span>
                  SUPER ADMIN possesses bypass authority and has all permissions enabled implicitly.
                </span>
              </div>
            ) : (
              <div className="divide-y text-xs">
                {permissions.map((p) => (
                  <div key={p.key} className="flex items-center justify-between py-3">
                    <div>
                      <div className="font-semibold text-sm">{p.label}</div>
                      <div className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">
                        {p.category}
                      </div>
                    </div>
                    <div>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        defaultChecked={
                          selectedRole === 'OPERATIONS_ADMIN' ||
                          (selectedRole === 'KYC_REVIEWER' && p.key.startsWith('kyc')) ||
                          (selectedRole === 'FINANCE_ADMIN' && p.key.startsWith('transactions')) ||
                          (selectedRole === 'SUPPORT_AGENT' && p.key.startsWith('tickets')) ||
                          (selectedRole === 'TEAM_LEADER' && p.key === 'riders_view')
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
