'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  gradient?: boolean;
}

export function Sparkline({
  data,
  width = 120,
  height = 40,
  color = '#0053C1',
  gradient = true,
}: SparklineProps) {
  const path =
    Math.max(...data) === 0 && Math.min(...data) === 0
      ? ''
      : (() => {
          if (data.length < 2) return '';
          const max = Math.max(...data);
          const min = Math.min(...data);
          const range = max - min || 1;
          const step = width / (data.length - 1);

          const points = data.map((value, index) => {
            const x = index * step;
            const y = height - ((value - min) / range) * (height - 4) - 2;
            return `${x},${y}`;
          });

          return `M ${points.join(' L ')}`;
        })();

  if (data.length < 2) return null;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`sparkGrad-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {gradient && (
        <path
          d={`${path} L ${width},${height} L 0,${height} Z`}
          fill={`url(#sparkGrad-${color})`}
        />
      )}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface DashboardCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  sparklineData?: number[];
  sparklineColor?: string;
  className?: string;
}

export function DashboardCard({
  title,
  value,
  change,
  changeLabel,
  icon,
  sparklineData,
  sparklineColor = '#0053C1',
  className,
}: DashboardCardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        {(change !== undefined || changeLabel) && (
          <div className="flex items-center gap-1 mt-1">
            {change !== undefined && (
              <span
                className={cn(
                  'text-xs font-medium flex items-center',
                  isPositive && 'text-green-500',
                  isNegative && 'text-red-500',
                  !isPositive && !isNegative && 'text-muted-foreground'
                )}
              >
                {isPositive && '↑'}
                {isNegative && '↓'}
                {Math.abs(change)}%
              </span>
            )}
            {changeLabel && <span className="text-xs text-muted-foreground">{changeLabel}</span>}
          </div>
        )}
        {sparklineData && sparklineData.length > 0 && (
          <div className="absolute bottom-0 right-0 opacity-50">
            <Sparkline data={sparklineData} color={sparklineColor} width={100} height={32} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

export function StatCard({ title, value, description, icon, trend, trendValue }: StatCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm font-medium text-muted-foreground">{title}</div>
            <div className="text-2xl font-bold mt-1">{value}</div>
            {description && <div className="text-xs text-muted-foreground mt-1">{description}</div>}
            {trend && trendValue && (
              <div
                className={cn(
                  'text-xs font-medium mt-2 flex items-center gap-1',
                  trend === 'up' && 'text-green-500',
                  trend === 'down' && 'text-red-500',
                  trend === 'neutral' && 'text-muted-foreground'
                )}
              >
                {trend === 'up' && '↑'}
                {trend === 'down' && '↓'}
                {trendValue}
              </div>
            )}
          </div>
          {icon && <div className="p-3 rounded-lg bg-primary/10 text-primary">{icon}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  subValue?: string;
  icon?: React.ReactNode;
  color?: string;
}

export function MetricCard({ label, value, subValue, icon, color }: MetricCardProps) {
  return (
    <div
      className="p-4 rounded-xl border bg-card text-card-foreground"
      style={{ borderLeftColor: color, borderLeftWidth: 4 }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        {icon}
      </div>
      <div className="text-2xl font-bold mt-2">{value}</div>
      {subValue && <div className="text-sm text-muted-foreground mt-1">{subValue}</div>}
    </div>
  );
}
