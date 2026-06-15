export interface SuspensionReason {
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  code?: string;
  actionAvailable?: boolean;
  actionLabel?: string;
  actionScreen?: string;
}

export interface QueuedAction {
  id: string;
  type: string;
  actionType: string;
  method: string;
  payload: unknown;
  createdAt: number;
  endpoint?: string;
  status?: string;
}

export interface ProcessResult {
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

export interface RiderCache {
  riderId?: string;
  walletBalance?: number;
  currentPlan?: string;
  assignedVehicle?: string;
  accountStatus?: string;
  kycStatus?: string;
  rentalStatus?: string;
}

export function subscribeToSync(callback: (state: unknown) => void): () => void {
  return () => {};
}

export function getPendingCount(): number {
  return 0;
}

export function isOnline(): boolean {
  return true;
}

export function enqueueAction(
  _actionType: string,
  _payload: unknown,
  _endpoint?: string,
  _method?: string
): QueuedAction {
  return {
    id: 'stub',
    type: _actionType,
    actionType: _actionType,
    method: _method || 'POST',
    payload: _payload,
    createdAt: Date.now(),
    endpoint: _endpoint,
  };
}

export function getSuspensionReasons(_rider?: unknown): SuspensionReason[] {
  return [];
}

export function cacheRiderState(_state: unknown): void {}

export function loadCachedRiderState(): RiderCache | null {
  return null;
}

export function processQueue(): Promise<ProcessResult> {
  return Promise.resolve({ failed: 0, errors: [] });
}

export function onConnectivityChange(_callback: (online: boolean) => void): () => void {
  return () => {};
}

export function clearRiderCache(): void {}

export function clearQueue(): void {}
