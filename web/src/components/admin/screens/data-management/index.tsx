'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Server, Archive, Calendar, RotateCcw, HardDrive, ListChecks, Shield } from 'lucide-react';
import { AdminErrorBoundary } from '../../error-boundary';

import { OverviewTab } from './OverviewTab';
import { BackupsTab } from './BackupsTab';
import { ScheduleTab } from './ScheduleTab';
import { RestoreTab } from './RestoreTab';
import { StorageTab } from './StorageTab';
import { BackupLogsTab } from './BackupLogsTab';
import { DisasterRecoveryTab } from './DisasterRecoveryTab';

export default function DataManagementScreen() {
  return (
    <AdminErrorBoundary>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Data Management</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Backup, restore, and manage data for your Voltium instance
          </p>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full sm:w-auto flex-wrap h-auto sm:h-10">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">
              <Server className="w-4 h-4 mr-1.5 hidden sm:inline" /> Overview
            </TabsTrigger>
            <TabsTrigger value="backups" className="text-xs sm:text-sm">
              <Archive className="w-4 h-4 mr-1.5 hidden sm:inline" /> Backups
            </TabsTrigger>
            <TabsTrigger value="schedule" className="text-xs sm:text-sm">
              <Calendar className="w-4 h-4 mr-1.5 hidden sm:inline" /> Schedule
            </TabsTrigger>
            <TabsTrigger value="restore" className="text-xs sm:text-sm">
              <RotateCcw className="w-4 h-4 mr-1.5 hidden sm:inline" /> Restore
            </TabsTrigger>
            <TabsTrigger value="storage" className="text-xs sm:text-sm">
              <HardDrive className="w-4 h-4 mr-1.5 hidden sm:inline" /> Storage
            </TabsTrigger>
            <TabsTrigger value="logs" className="text-xs sm:text-sm">
              <ListChecks className="w-4 h-4 mr-1.5 hidden sm:inline" /> Logs
            </TabsTrigger>
            <TabsTrigger value="disaster-recovery" className="text-xs sm:text-sm">
              <Shield className="w-4 h-4 mr-1.5 hidden sm:inline" /> DR
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <OverviewTab />
          </TabsContent>

          <TabsContent value="backups" className="mt-6">
            <BackupsTab />
          </TabsContent>

          <TabsContent value="schedule" className="mt-6">
            <ScheduleTab />
          </TabsContent>

          <TabsContent value="restore" className="mt-6">
            <RestoreTab />
          </TabsContent>

          <TabsContent value="storage" className="mt-6">
            <StorageTab />
          </TabsContent>

          <TabsContent value="logs" className="mt-6">
            <BackupLogsTab />
          </TabsContent>

          <TabsContent value="disaster-recovery" className="mt-6">
            <DisasterRecoveryTab />
          </TabsContent>
        </Tabs>
      </div>
    </AdminErrorBoundary>
  );
}
