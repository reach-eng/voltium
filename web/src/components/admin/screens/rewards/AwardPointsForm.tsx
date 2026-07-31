'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import type { RiderListItem } from './types';

interface AwardPointsFormProps {
  riders: RiderListItem[];
  riderSearch: string;
  setRiderSearch: (v: string) => void;
  selectedRider: string;
  setSelectedRider: (v: string) => void;
  title: string;
  setTitle: (v: string) => void;
  points: string;
  setPoints: (v: string) => void;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

/**
 * R3.7l split — Award Points form.
 *
 * Inline card with 4 columns: rider picker (search + select), title
 * (reason), points (number), and the submit button. Slides in from
 * the top on mount. Submit calls the data hook's `handleAwardPoints`.
 */
export function AwardPointsForm({
  riders,
  riderSearch,
  setRiderSearch,
  selectedRider,
  setSelectedRider,
  title,
  setTitle,
  points,
  setPoints,
  isSubmitting,
  onSubmit,
}: AwardPointsFormProps) {
  return (
    <Card className="bg-card rounded-xl border-primary/20 shadow-lg animate-in fade-in slide-in-from-top-4 duration-300">
      <CardContent className="p-6">
        <form
          onSubmit={onSubmit}
          className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
        >
          <div className="space-y-2">
            <Label>Rider Selection</Label>
            <Input
              placeholder="Search riders..."
              value={riderSearch}
              onChange={(e) => setRiderSearch(e.target.value)}
              className="bg-vf-surface"
            />
            <Select value={selectedRider} onValueChange={setSelectedRider}>
              <SelectTrigger className="bg-vf-surface">
                <SelectValue placeholder="Choose a rider" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                {riders.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.fullName} ({r.riderId})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="title">Reason / Title</Label>
            <Input
              id="title"
              placeholder="e.g. Weekly Bonus"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-vf-surface"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="points">Points</Label>
            <Input
              id="points"
              type="number"
              placeholder="Points amount"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              className="bg-vf-surface"
            />
          </div>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Award'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
