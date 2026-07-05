import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { tokenStorage } from '../api/axiosInstance';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

let connection: HubConnection | null = null;

// Lazily build a single shared hub connection. The token is supplied per-request via
// accessTokenFactory (SignalR appends it as ?access_token=), so reconnects always use a fresh one.
export function getChatConnection(): HubConnection {
  if (!connection) {
    connection = new HubConnectionBuilder()
      .withUrl(`${BASE_URL}/hubs/chat`, {
        accessTokenFactory: () => tokenStorage.getAccess() ?? '',
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 15000])
      .configureLogging(LogLevel.Warning)
      .build();
  }
  return connection;
}

export async function startChatConnection(): Promise<HubConnection | null> {
  const conn = getChatConnection();
  if (conn.state === HubConnectionState.Disconnected) {
    try {
      await conn.start();
    } catch {
      return null; // provider will surface degraded state; REST still works.
    }
  }
  return conn;
}

export async function stopChatConnection(): Promise<void> {
  if (connection && connection.state !== HubConnectionState.Disconnected) {
    try { await connection.stop(); } catch { /* ignore */ }
  }
  connection = null;
}
