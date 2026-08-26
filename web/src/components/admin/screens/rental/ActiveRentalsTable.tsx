'use client';

import { CalendarDays, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { riderDisplayName, type ActiveRental, type RentalPlan } from './types';

interface ActiveRentalsTableProps {
  activeRentals: ActiveRental[];
  filteredRentals: ActiveRental[];
  plans: RentalPlan[];
  rentalSearch: string;
  rentalFilter: string;
  onSearchChange: (v: string) => void;
  onFilterChange: (v: string) => void;
  onClearFilters: () => void;
}

/**
 * R3.7y split — Active Rentals table + search/filter row.
 */
export function ActiveRentalsTable({
  activeRentals,
  filteredRentals,
  plans,
  rentalSearch,
  rentalFilter,
  onSearchChange,
  onFilterChange,
  onClearFilters,
}: ActiveRentalsTableProps) {
  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-4">
        Active Rentals
        <span className="ml-2 text-sm font-normal text-muted-foreground">
          ({activeRentals.length} active
          {rentalSearch || rentalFilter !== 'ALL'
            ? ` · ${filteredRentals.length} shown`
            : ''}
          )
        </span>
      </h2>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone..."
            value={rentalSearch}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 h-9 rounded-xl border-muted-foreground/20 text-sm"
          />
        </div>
        <Select value={rentalFilter} onValueChange={onFilterChange}>
          <SelectTrigger className="h-9 w-44 rounded-xl border-muted-foreground/20 text-sm">
            <SelectValue placeholder="All Plans" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Plans</SelectItem>
            {plans
              .filter((p) => p.isActive)
              .map((p) => (
                <SelectItem key={p.id} value={p.name}>
                  {p.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        {(rentalSearch || rentalFilter !== 'ALL') && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
            onClick={onClearFilters}
          >
            <X className="w-3 h-3 mr-1" /> Clear
          </Button>
        )}
      </div>

      <Card className="rounded-xl shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {filteredRentals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CalendarDays className="w-10 h-10 mb-2 opacity-40" />
              <p className="text-sm">
                {activeRentals.length === 0
                  ? 'No active rentals'
                  : 'No rentals match your filter'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rider</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Current Plan</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRentals.map((rental) => (
                  <TableRow key={rental.id}>
                    <TableCell className="font-medium text-sm">
                      {riderDisplayName(rental)}
                    </TableCell>
                    <TableCell className="text-sm">{rental.phone}</TableCell>
                    <TableCell className="text-sm">{rental.currentPlan || '-'}</TableCell>
                    <TableCell className="text-sm font-mono">
                      {rental.assignedVehicle || rental.vehicleId || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400 text-xs"
                      >
                        ACTIVE
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
