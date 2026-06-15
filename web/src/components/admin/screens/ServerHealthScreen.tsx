'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HardDrive, Server, RefreshCw, Cpu, Database, Network } from 'lucide-react';
import { toast } from 'sonner';

export default function ServerHealthScreen() {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = () => {
    setLoading(true);
    // Simulate query of server health check endpoint
    setTimeout(() => {
      setHealth({
        database: 'Connected (localhost:5432)',
        databasePool: 'Active (3/10 used)',
        localStorage: 'Writable (D:/VoltiumServer/data/uploads)',
        backupStorage: 'Writable (D:/VoltiumServer/backups)',
        secondaryBackup: 'Connected (Secondary Drive E:)',
        freeDiskGb: 128,
        totalDiskGb: 512,
        cpuUsage: '14%',
        ramUsage: '4.2 GB / 16.0 GB',
        pm2Status: 'Online (next-service, backup-worker)',
        caddyStatus: 'Active',
      });
      setLoading(false);
    }, 500);
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Server Health</h2>
          <p className="text-muted-foreground">Monitor local laptop service status, storage path permissions, and resource metrics.</p>
        </div>
        <Button variant="outline" onClick={fetchHealth} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Checks
        </Button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-muted-foreground">Running system diagnosis...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-base font-bold">Services & Daemons</CardTitle>
              <Server className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">PostgreSQL Database</span>
                <Badge className="bg-emerald-600 text-white">RUNNING</Badge>
              </div>
              <div className="text-xs text-muted-foreground">{health.database}</div>

              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm font-medium">PM2 Processes</span>
                <Badge className="bg-emerald-600 text-white">ONLINE</Badge>
              </div>
              <div className="text-xs text-muted-foreground">{health.pm2Status}</div>

              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm font-medium">Caddy Reverse Proxy</span>
                <Badge className="bg-emerald-600 text-white">ACTIVE</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-base font-bold">Local Storage Status</CardTitle>
              <HardDrive className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Upload Directory</span>
                <Badge className="bg-emerald-600 text-white">WRITABLE</Badge>
              </div>
              <div className="text-xs text-muted-foreground">{health.localStorage}</div>

              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm font-medium">Primary Backup Directory</span>
                <Badge className="bg-emerald-600 text-white">WRITABLE</Badge>
              </div>
              <div className="text-xs text-muted-foreground">{health.backupStorage}</div>

              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm font-medium">Secondary USB Drive</span>
                <Badge className="bg-emerald-600 text-white">CONNECTED</Badge>
              </div>
              <div className="text-xs text-muted-foreground">{health.secondaryBackup}</div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-base font-bold">Laptop Hardware Metrics</CardTitle>
              <Cpu className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground uppercase">CPU Utilization</div>
                <div className="text-2xl font-bold">{health.cpuUsage}</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground uppercase">RAM Usage</div>
                <div className="text-2xl font-bold">{health.ramUsage}</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground uppercase">Disk Space (Remaining)</div>
                <div className="text-2xl font-bold">{health.freeDiskGb} GB <span className="text-xs font-normal text-muted-foreground">/ {health.totalDiskGb} GB</span></div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
