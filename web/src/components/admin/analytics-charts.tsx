'use client';

import { useEffect, useState, useRef } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ChartData {
  label: string;
  value: number;
}

interface AnalyticsChartProps {
  title: string;
  data: ChartData[];
  type?: 'line' | 'bar' | 'area';
  color?: string;
  showLegend?: boolean;
  showGrid?: boolean;
  height?: number;
  onPointClick?: (point: ChartData) => void;
}

export function AnalyticsChart({
  title,
  data,
  type = 'area',
  color = '#0053C1',
  showLegend = false,
  showGrid = true,
  height = 300,
  onPointClick,
}: AnalyticsChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const chartHeight = height - 60;
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartWidth = width - padding.left - padding.right;

    ctx.clearRect(0, 0, width, height);

    const maxValue = Math.max(...data.map((d) => d.value));
    const minValue = Math.min(...data.map((d) => d.value));
    const range = maxValue - minValue || 1;

    const getX = (index: number) => padding.left + (index / (data.length - 1)) * chartWidth;
    const getY = (value: number) =>
      padding.top + chartHeight - ((value - minValue) / range) * chartHeight;

    if (showGrid) {
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      const gridLines = 5;
      for (let i = 0; i <= gridLines; i++) {
        const y = padding.top + (i / gridLines) * chartHeight;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    if (type === 'area' || type === 'line') {
      const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
      gradient.addColorStop(0, `${color}33`);
      gradient.addColorStop(1, `${color}00`);

      ctx.beginPath();
      ctx.moveTo(getX(0), getY(data[0].value));
      data.forEach((point, index) => {
        ctx.lineTo(getX(index), getY(point.value));
      });
      ctx.lineTo(getX(data.length - 1), padding.top + chartHeight);
      ctx.lineTo(getX(0), padding.top + chartHeight);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(getX(0), getY(data[0].value));
      data.forEach((point, index) => {
        ctx.lineTo(getX(index), getY(point.value));
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

      data.forEach((point, index) => {
        ctx.beginPath();
        ctx.arc(getX(index), getY(point.value), 4, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    } else if (type === 'bar') {
      const barWidth = chartWidth / data.length - 8;
      data.forEach((point, index) => {
        const x = getX(index) - barWidth / 2;
        const barHeight = ((point.value - minValue) / range) * chartHeight;
        const y = padding.top + chartHeight - barHeight;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 4);
        ctx.fill();
      });
    }

    ctx.fillStyle = '#64748b';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    data.forEach((point, index) => {
      ctx.fillText(point.label, getX(index), height - 10);
    });

    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const value = minValue + ((4 - i) / 4) * range;
      const y = padding.top + (i / 4) * chartHeight;
      ctx.fillText(Math.round(value).toString(), padding.left - 10, y + 4);
    }
  }, [data, type, color, showGrid, height]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <canvas ref={canvasRef} className="w-full" style={{ height }} />
      </CardContent>
    </Card>
  );
}

interface RevenueChartProps {
  data: ChartData[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  return <AnalyticsChart title="Revenue Trends" data={data} type="area" color="#10B981" />;
}

interface RidesChartProps {
  data: ChartData[];
}

export function RidesChart({ data }: RidesChartProps) {
  return <AnalyticsChart title="Rides Overview" data={data} type="bar" color="#3B82F6" />;
}

interface UserGrowthChartProps {
  data: ChartData[];
}

export function UserGrowthChart({ data }: UserGrowthChartProps) {
  return <AnalyticsChart title="User Growth" data={data} type="line" color="#8B5CF6" />;
}

interface TrendIndicatorProps {
  value: number;
  previousValue: number;
  label?: string;
}

export function TrendIndicator({ value, previousValue, label }: TrendIndicatorProps) {
  const percentChange = previousValue ? ((value - previousValue) / previousValue) * 100 : 0;
  const isPositive = percentChange > 0;
  const isNegative = percentChange < 0;

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'flex items-center gap-1 text-sm font-medium',
          isPositive && 'text-green-500',
          isNegative && 'text-red-500',
          !isPositive && !isNegative && 'text-muted-foreground'
        )}
      >
        {isPositive && <TrendingUp className="h-4 w-4" />}
        {isNegative && <TrendingDown className="h-4 w-4" />}
        {!isPositive && !isNegative && <Minus className="h-4 w-4" />}
        {Math.abs(percentChange).toFixed(1)}%
      </div>
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
    </div>
  );
}

interface StatsOverviewProps {
  stats: Array<{
    label: string;
    value: string | number;
    change?: number;
    trend?: 'up' | 'down' | 'neutral';
  }>;
}

export function StatsOverview({ stats }: StatsOverviewProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <Card key={index}>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">{stat.label}</div>
            <div className="text-2xl font-bold mt-1">{stat.value}</div>
            {stat.change !== undefined && (
              <TrendIndicator value={stat.change} previousValue={100 - stat.change} />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
