'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

interface UseWebSocketOptions {
  /** WebSocket server URL (e.g. 'wss://api.voltium.in/ws') */
  url: string;
  /** Auto-reconnect on disconnect (default: true) */
  reconnect?: boolean;
  /** Max reconnect delay in ms (default: 30s, uses exponential backoff) */
  maxReconnectDelay?: number;
  /** Message handler */
  onMessage?: (data: unknown) => void;
}

/**
 * WebSocket hook for real-time updates.
 *
 * Currently Voltium uses 30s polling. Upgrade to WebSocket:
 *   1. Set up a WebSocket server (e.g. with ws or Socket.IO on the backend)
 *   2. Replace polling intervals with this hook
 *   3. Use `sendMessage` to subscribe to topics ('dashboard', 'tickets', etc.)
 *
 * @example
 * ```tsx
 * const { isConnected, lastMessage } = useWebSocket({
 *   url: 'wss://api.voltium.in/ws',
 *   onMessage: (data) => updateDashboard(data),
 * });
 * ```
 */
export function useWebSocket({
  url,
  reconnect = true,
  maxReconnectDelay = 30_000,
  onMessage,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<unknown>(null);
  const connectRef = useRef<() => void>(() => {});
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const connect = useCallback(
    function connectSocket() {
      try {
        const ws = new WebSocket(url);

        ws.onopen = () => {
          setIsConnected(true);
          reconnectAttemptRef.current = 0;
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            setLastMessage(data);
            onMessageRef.current?.(data);
          } catch {
            setLastMessage(event.data);
            onMessageRef.current?.(event.data);
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          wsRef.current = null;

          if (reconnect) {
            const delay = Math.min(
              1000 * Math.pow(2, reconnectAttemptRef.current),
              maxReconnectDelay
            );
            reconnectAttemptRef.current += 1;
            setTimeout(() => connectSocket(), delay);
          }
        };

        ws.onerror = () => {
          ws.close();
        };

        wsRef.current = ws;
      } catch {
        // WebSocket not available in this environment
      }
    },
    [url, reconnect, maxReconnectDelay]
  );

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const sendMessage = useCallback((data: unknown) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(typeof data === 'string' ? data : JSON.stringify(data));
    }
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  return { isConnected, lastMessage, sendMessage, disconnect };
}
