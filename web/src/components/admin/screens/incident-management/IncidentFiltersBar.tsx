'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  Plus,
  Search,
  CheckCircle2,
  Shield,
} from 'lucide-react';

interface IncidentFiltersBarProps {
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  typeFilter: string;
  setTypeFilter: (val: string) => void;
  search: string;
  setSearch: (val: string) => void;
  incidentTypes: string[];
  statusCounts: {
    OPEN: number;
    INVESTIGATING: number;
    RESOLVED: number;
    CLOSED: number;
  };
  onCreateClick: () => void;
}

export function IncidentFiltersBar({
  statusFilter,
  setStatusFilter,
  typeFilter,
  setTypeFilter,
  search,
  setSearch,
  incidentTypes,
  statusCounts,
  onCreateClick,
}: IncidentFiltersBarProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-primary" />
            Incident Management
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Track and resolve rider incidents
          </p>
        </div>
        <Button
          size="sm"
          className="rounded-full px-4 h-9"
          onClick={onCreateClick}
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Incident
        </Button>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-blue-500/20 bg-blue-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Open</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {statusCounts.OPEN}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Search className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                Investigating
              </p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {statusCounts.INVESTIGATING}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                Resolved
              </p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {statusCounts.RESOLVED}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-500/20 bg-slate-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                Closed
              </p>
              <p className="text-2xl font-bold text-slate-600 dark:text-slate-400">
                {statusCounts.CLOSED}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="INVESTIGATING">Investigating</SelectItem>
            <SelectItem value="RESOLVED">Resolved</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            {incidentTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1 max-w-sm ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by ID, title, or rider..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>
    </div>
  );
}
