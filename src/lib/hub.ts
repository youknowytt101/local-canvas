// The notification hub, as Cosmos opens it (createWebsocketHubConnection, module 1397): a SignalR HubConnection to the
// server's /notification-hub (cosmos-lite lib/hub.js speaks SignalR's JSON protocol: negotiate, then a WebSocket with
// the access token), keep-alive 15 s, server timeout 30 s, reconnecting after 0 / 2 / 5 / 10 s
// (WEBSOCKET_HUB_KEEP_ALIVE_INTERVAL_MS, WEBSOCKET_HUB_SERVER_TIMEOUT_MS, WEBSOCKET_HUB_AUTOMATIC_RECONNECT_DELAYS_MS).
// Step 2 uses it to send impressions (RecordImpressionsBatch); the pushes (Notification) come with the screens that
// listen to them.
import { HttpTransportType, HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { accessToken, hasSession } from './auth';
import { serverUrl } from './server';

const KEEP_ALIVE_MS = 15000;
const SERVER_TIMEOUT_MS = 30000;
const RECONNECT_DELAYS_MS = [0, 2000, 5000, 10000];

let connection: HubConnection | null = null;
let connectionBase: string | null = null;
let starting: Promise<void> | null = null;

export const hubConnected = () => connection?.state === HubConnectionState.Connected;

export function startHub(): Promise<void> {
  const base = serverUrl();
  if (!base || !hasSession()) return Promise.resolve();
  if (connection && connectionBase !== base) void stopHub();
  if (!connection) {
    connectionBase = base;
    connection = new HubConnectionBuilder()
      .withUrl(`${base}/notification-hub`, { transport: HttpTransportType.WebSockets, accessTokenFactory: async () => (await accessToken()) ?? '' })
      .withAutomaticReconnect(RECONNECT_DELAYS_MS)
      .configureLogging(LogLevel.None)
      .build();
    connection.keepAliveIntervalInMilliseconds = KEEP_ALIVE_MS;
    connection.serverTimeoutInMilliseconds = SERVER_TIMEOUT_MS;
    connection.onclose(() => { starting = null; });
  }
  if (connection.state !== HubConnectionState.Disconnected) return starting ?? Promise.resolve();
  const c = connection;
  starting = c.start().catch(() => undefined).finally(() => { if (connection === c) starting = null; });
  return starting;
}

export async function stopHub() {
  const c = connection;
  connection = null;
  connectionBase = null;
  starting = null;
  if (c) await c.stop().catch(() => undefined);
}

export async function invoke<T = unknown>(method: string, ...args: unknown[]): Promise<T> {
  if (!connection || !hubConnected()) throw new Error('hub 没有连上');
  return connection.invoke<T>(method, ...args);
}
