'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Filter, Search } from 'lucide-react';
import type { HubOption } from './types';

interface FleetFiltersSidebarProps {
  hubs: HubOption[];
  search: string;
  setSearch: (v: string) => void;
  hubFilter: string;
  setHubFilter: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  lowBatteryOnly: boolean;
  setLowBatteryOnly: (v: boolean) => void;
}

/**
 * R3 split (FleetMapScreen) — filters sidebar.
 *
 * Search input (icon-prefixed), Hub select, Status select, and a
 * Low Battery Only toggle. All four feed the API params; the search
 * is debounced 500ms in the data hook.
 */
export function FleetFiltersSidebar({
  hubs,
  search,
  setSearch,
  hubFilter,
  setHubFilter,
  statusFilter,
  setStatusFilter,
  lowBatteryOnly,
  setLowBatteryOnly,
}: FleetFiltersSidebarProps) {
  return (
    <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden h-fit">
      <CardHeader className="pb-3 px-4 pt-4">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <Filter className="w-4 h-4" />
          Filters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-4 pb-4">
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Search Rider</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Name, Phone, ID..."
              className="pl-9 h-11 text-base rounded-xl"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Hub</Label>
          <Select value={hubFilter} onValueChange={setHubFilter}>
            <SelectTrigger className="h-11 text-base">
              <SelectValue placeholder="All Hubs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Hubs</SelectItem>
              {hubs.map((hub) => (
                <SelectItem key={hub.id} value={hub.name}>
                  {hub.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-11 text-base">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="idle">Idle</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">Low Battery Only</Label>
          <Switch checked={lowBatteryOnly} onCheckedChange={setLowBatteryOnly} />
        </div>
      </CardContent>
    </Card>
  );
}
