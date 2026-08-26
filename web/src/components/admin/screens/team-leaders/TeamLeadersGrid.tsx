'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { TeamLeaderCard } from './TeamLeaderCard';
import type { TeamLeader } from './types';

interface TeamLeadersGridProps {
  leaders: TeamLeader[];
  selectedIds: Set<string>;
  toggleLoading: string | null;
  loading: boolean;
  hasFilter: boolean;
  onToggleSelect: (id: string, checked: boolean) => void;
  onToggleActive: (leader: TeamLeader) => void;
  onViewStats: (leader: TeamLeader) => void;
  onEdit: (leader: TeamLeader) => void;
  onDelete: (leader: TeamLeader) => void;
  onSelectAllVisible: (checked: boolean) => void;
}

function TeamLeaderCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-5 w-32 mb-2" />
            <Skeleton className="h-4 w-16 rounded-full" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="flex items-center justify-between pt-3 border-t">
          <Skeleton className="h-8 w-24 rounded-md" />
          <div className="flex gap-1">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * R3.7aa split — team-leader cards grid (with select-all + skeleton/empty states).
 */
export function TeamLeadersGrid({
  leaders,
  selectedIds,
  toggleLoading,
  loading,
  hasFilter,
  onToggleSelect,
  onToggleActive,
  onViewStats,
  onEdit,
  onDelete,
  onSelectAllVisible,
}: TeamLeadersGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-500">
        {[...Array(3)].map((_, i) => (
          <TeamLeaderCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (leaders.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {hasFilter ? 'No team leaders match' : 'No team leaders yet'}
      </div>
    );
  }

  const allSelected = selectedIds.size === leaders.length && leaders.length > 0;

  return (
    <div>
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 mb-3 px-1">
          <Checkbox
            checked={allSelected}
            onCheckedChange={(checked) => onSelectAllVisible(!!checked)}
          />
          <span className="text-xs text-muted-foreground">
            Select All ({leaders.length})
          </span>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {leaders.map((l) => (
          <TeamLeaderCard
            key={l.id}
            leader={l}
            selected={selectedIds.has(l.id)}
            toggleLoading={toggleLoading === l.id}
            onSelect={onToggleSelect}
            onToggleActive={onToggleActive}
            onViewStats={onViewStats}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}
