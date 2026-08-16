'use client';

import { Loader2, Mail, Pencil, Phone, Trash2, UserCircle, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPhone } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  formatLeaderDate,
  riderCountLabel,
  statusBadgeClass,
  type TeamLeader,
} from './types';

interface TeamLeaderCardProps {
  leader: TeamLeader;
  selected: boolean;
  toggleLoading: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onToggleActive: (leader: TeamLeader) => void;
  onViewStats: (leader: TeamLeader) => void;
  onEdit: (leader: TeamLeader) => void;
  onDelete: (leader: TeamLeader) => void;
}

/**
 * R3.7aa split — single team-leader card with checkbox, status badge,
 * contact rows, action buttons.
 */
export function TeamLeaderCard({
  leader,
  selected,
  toggleLoading,
  onSelect,
  onToggleActive,
  onViewStats,
  onEdit,
  onDelete,
}: TeamLeaderCardProps) {
  const riderCount = leader.riderCount || 0;

  return (
    <Card className={selected ? 'ring-2 ring-primary/30 bg-primary/[0.02]' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={selected}
              onCheckedChange={(checked) => onSelect(leader.id, !!checked)}
            />
            <div
              className={`p-2 rounded-full bg-primary/10 ${!leader.isActive ? 'opacity-40' : ''}`}
            >
              <UserCircle
                className={`h-6 w-6 ${
                  leader.isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              />
            </div>
            <div>
              <CardTitle
                className={`text-base ${!leader.isActive ? 'opacity-50' : ''}`}
              >
                {leader.name}
              </CardTitle>
              <Badge
                variant="outline"
                className={`mt-1 text-[10px] font-bold ${statusBadgeClass(leader.isActive)}`}
              >
                {leader.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-3.5 w-3.5" />
            <span>{formatPhone(leader.phone)}</span>
          </div>
          {leader.email && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-3.5 w-3.5" />
              <span>{leader.email}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>{riderCountLabel(riderCount)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Created: {formatLeaderDate(leader.createdAt)}
          </p>
        </div>
        <div className="flex items-center justify-between pt-3 border-t">
          <Button
            variant={leader.isActive ? 'outline' : 'default'}
            size="sm"
            disabled={toggleLoading}
            onClick={() => onToggleActive(leader)}
          >
            {toggleLoading ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : null}
            {leader.isActive ? 'Deactivate' : 'Activate'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            // WEB-AUDIT 2026-08-14 P0-4: the previous `dark:text-white`
            // override combined with a light-locked secondary-button
            // surface produced white-on-light in dark mode. The
            // default secondary variant already binds to the
            // `secondary-foreground` token (which flips in `.dark`),
            // so the explicit override can be dropped.
            onClick={() => onViewStats(leader)}
          >
            Drivers &amp; Stats
          </Button>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Edit team leader"
              onClick={() => onEdit(leader)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500"
              aria-label="Delete team leader"
              onClick={() => onDelete(leader)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
