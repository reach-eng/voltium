'use client';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DestructiveConfirm } from './DestructiveConfirm';
import { Loader2, Power } from 'lucide-react';

export interface MaintenanceToggleButtonProps {
  enabled: boolean;
  onToggle: (newEnabled: boolean) => Promise<void> | void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

export function MaintenanceToggleButton({
  enabled,
  onToggle,
  disabled = false,
  loading = false,
  className,
}: MaintenanceToggleButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleButtonClick = () => {
    if (enabled) {
      // Disabling maintenance mode: prompt with standard confirmation
      setConfirmOpen(true);
    } else {
      // Enabling maintenance mode: requires typing 'MAINTENANCE'
      setConfirmOpen(true);
    }
  };

  const handleConfirmedToggle = async () => {
    setSubmitting(true);
    try {
      await onToggle(!enabled);
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button
        variant={enabled ? 'destructive' : 'default'}
        disabled={disabled || loading || submitting}
        onClick={handleButtonClick}
        className={className}
        data-testid="maintenance-toggle-btn"
      >
        {loading || submitting ? (
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        ) : (
          <Power className="w-4 h-4 mr-2" />
        )}
        {enabled ? 'Disable Maintenance' : 'Enable Maintenance'}
      </Button>

      <DestructiveConfirm
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={enabled ? 'Disable Maintenance Mode' : 'Enable System Maintenance Mode'}
        description={
          enabled ? (
            <p>
              Are you sure you want to disable maintenance mode? All rider-facing API routes and app functions will resume normal operation.
            </p>
          ) : (
            <p>
              Enabling maintenance mode is a global kill-switch that immediately pauses rider operations and locks active workflows.
            </p>
          )
        }
        expectedPhrase={enabled ? 'DISABLE' : 'MAINTENANCE'}
        confirmLabel={enabled ? 'Disable Maintenance' : 'Enable Maintenance'}
        variant={enabled ? 'default' : 'destructive'}
        loading={submitting}
        onConfirm={handleConfirmedToggle}
      />
    </>
  );
}
