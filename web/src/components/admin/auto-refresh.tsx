'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface AutoRefreshConfig {
  endpoint: string;
  interval?: number;
  enabled?: boolean;
}

interface AutoRefreshData {
  [key: string]: unknown;
}

interface AutoRefreshUpdate {
  type: 'create' | 'update' | 'delete';
  data: AutoRefreshData;
  timestamp: number;
}

interface UseAutoRefreshOptions {
  endpoint: string;
  interval?: number;
  onUpdate?: (data: AutoRefreshData[]) => void;
}

export function useAutoRefresh({ endpoint, interval = 5000, onUpdate }: UseAutoRefreshOptions) {
  const [data, setData] = useState<AutoRefreshData[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error('Failed to fetch');
      const result = await response.json();
      const newData = result.data || result;
      setData(newData);
      setLastUpdate(new Date());
      setIsUpdating(true);
      setError(null);
      onUpdate?.(newData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection error');
      setIsUpdating(false);
    }
  }, [endpoint, onUpdate]);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchData, interval]);

  return { data, isUpdating, lastUpdate, error, refetch: fetchData };
}

interface AutoRefreshCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  isUpdating?: boolean;
}

export function AutoRefreshCard({
  title,
  value,
  change,
  changeLabel,
  icon,
  isUpdating,
}: AutoRefreshCardProps) {
  const [flash, setFlash] = useState(false);
  const prevValue = useRef(value);

  useEffect(() => {
    if (prevValue.current !== value) {
      // Use setTimeout to avoid synchronous setState inside an effect
      const triggerFlash = setTimeout(() => setFlash(true), 0);
      const timer = setTimeout(() => setFlash(false), 500);
      prevValue.current = value;
      return () => {
        clearTimeout(triggerFlash);
        clearTimeout(timer);
      };
    }
  }, [value]);

  return (
    <Card className={cn('transition-all', flash && 'ring-2 ring-primary')}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className={cn('text-3xl font-bold transition-opacity', isUpdating && 'opacity-50')}>
          {value}
        </div>
        {change !== undefined && (
          <div
            className={cn(
              'text-xs font-medium mt-1',
              change > 0 && 'text-green-500',
              change < 0 && 'text-red-500',
              change === 0 && 'text-muted-foreground'
            )}
          >
            {change > 0 ? '+' : ''}
            {change}% {changeLabel}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface AutoRefreshBadgeProps {
  isUpdating: boolean;
  lastUpdate: Date | null;
}

export function AutoRefreshBadge({ isUpdating, lastUpdate }: AutoRefreshBadgeProps) {
  const [timeAgo, setTimeAgo] = useState('');

  useEffect(() => {
    if (!lastUpdate) return;

    const update = () => {
      const seconds = Math.floor((Date.now() - lastUpdate.getTime()) / 1000);
      if (seconds < 5) setTimeAgo('Just now');
      else if (seconds < 60) setTimeAgo(`${seconds}s ago`);
      else setTimeAgo(`${Math.floor(seconds / 60)}m ago`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [lastUpdate]);

  return (
    <Badge variant={isUpdating ? 'default' : 'destructive'} className="gap-1">
      <span
        className={cn(
          'h-2 w-2 rounded-full',
          isUpdating ? 'bg-green-500 animate-pulse' : 'bg-red-500'
        )}
      />
      {isUpdating ? `Auto-Refreshed: ${timeAgo}` : 'Disconnected'}
    </Badge>
  );
}

interface AutoRefreshTableProps<T> {
  data: T[];
  columns: Array<{
    key: string;
    header: string;
    render?: (row: T) => React.ReactNode;
  }>;
  keyField: keyof T;
  highlightFields?: (keyof T)[];
}

export function AutoRefreshTable<T>({
  data,
  columns,
  keyField,
  highlightFields = [],
}: AutoRefreshTableProps<T>) {
  const [highlightedRows, setHighlightedRows] = useState<Set<string>>(new Set());
  const prevDataRef = useRef<T[]>([]);

  useEffect(() => {
    const prevIds = new Set(prevDataRef.current.map((row) => String(row[keyField])));
    const currentIds = new Set(data.map((row) => String(row[keyField])));
    const changedIds = new Set([...currentIds].filter((id) => !prevIds.has(id)));

    if (changedIds.size > 0) {
      const triggerHighlight = setTimeout(() => setHighlightedRows(changedIds), 0);
      const timer = setTimeout(() => setHighlightedRows(new Set()), 1000);
      prevDataRef.current = data;
      return () => {
        clearTimeout(triggerHighlight);
        clearTimeout(timer);
      };
    }

    prevDataRef.current = data;
  }, [data, keyField]);

  return (
    <div className="rounded-md border">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="p-3 text-left text-sm font-medium">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const rowKey = String(row[keyField]);
            const isHighlighted = highlightedRows.has(rowKey);
            return (
              <tr
                key={rowKey}
                className={cn('border-t transition-colors', isHighlighted && 'bg-green-500/10')}
              >
                {columns.map((column) => (
                  <td key={column.key} className="p-3 text-sm">
                    {column.render ? column.render(row) : String(row[column.key as keyof T] ?? '')}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface AutoRefreshConnectionStatusProps {
  isUpdating: boolean;
  onReconnect?: () => void;
}

export function AutoRefreshConnectionStatus({
  isUpdating,
  onReconnect,
}: AutoRefreshConnectionStatusProps) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn('h-2 w-2 rounded-full', isUpdating ? 'bg-green-500' : 'bg-red-500')} />
      <span className="text-sm text-muted-foreground">
        {isUpdating ? 'Auto-Refresh Active' : 'Auto-Refresh Inactive'}
      </span>
      {!isUpdating && onReconnect && (
        <Button variant="ghost" size="sm" onClick={onReconnect}>
          Retry
        </Button>
      )}
    </div>
  );
}
