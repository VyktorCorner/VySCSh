import { randomUUID, timingSafeEqual } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';
import type { HostOptions } from '../shared/types';
import { startDiscoveryResponder } from './discovery';

type Role = 'host' | 'viewer';
type Peer = { role: Role; id: string; authed: boolean; attempts: number; windowStart: number };
export type RunningHost = { close(): Promise<void>; discoveryEnabled: boolean };

function secureEquals(a: string, b: string): boolean {
  const x = Buffer.from(a, 'utf8');
  const y = Buffer.from(b, 'utf8');
  return x.length === y.length && timingSafeEqual(x, y);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function startSignaling(options: HostOptions): Promise<RunningHost> {
  const { bindIp, port, accessKey } = options;
  const peers = new Map<WebSocket, Peer>();
  const viewers = new Map<string, WebSocket>();
  let host: WebSocket | null = null;
  const wss = new WebSocketServer({ host: bindIp, port, maxPayload: 100_000, perMessageDeflate: false });

  const send = (ws: WebSocket, message: Record<string, unknown>) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
  };
  const error = (ws: WebSocket, code: string) => send(ws, { type: 'error', code });

  wss.on('connection', (ws) => {
    const peer: Peer = { id: '', role: 'viewer', authed: false, attempts: 0, windowStart: Date.now() };
    peers.set(ws, peer);
    const authTimeout = setTimeout(() => { if (!peer.authed) ws.close(1008, 'authentication required'); }, 10_000);

    ws.on('message', (buffer) => {
      const now = Date.now();
      if (now - peer.windowStart >= 1000) {
        peer.windowStart = now;
        peer.attempts = 0;
      }
      peer.attempts += 1;
      if (peer.attempts > 100) { ws.close(1008, 'rate limited'); return; }

      let msg: Record<string, unknown>;
      try {
        const parsed: unknown = JSON.parse(buffer.toString());
        if (!isObject(parsed) || typeof parsed.type !== 'string') return error(ws, 'BAD_MESSAGE');
        msg = parsed;
      } catch { return error(ws, 'INVALID_JSON'); }

      if (!peer.authed) {
        if (msg.type !== 'auth' || typeof msg.key !== 'string' || (msg.role !== 'host' && msg.role !== 'viewer')) {
          return error(ws, 'AUTH_REQUIRED');
        }
        if (!secureEquals(msg.key, accessKey)) { ws.close(1008, 'invalid room key'); return; }
        if (msg.role === 'host') {
          if (host !== null) { ws.close(1008, 'host already connected'); return; }
          host = ws;
          peer.id = 'host';
          peer.role = 'host';
        } else {
          if (!host || host.readyState !== WebSocket.OPEN) { ws.close(1008, 'host not ready'); return; }
          if (viewers.size >= 4) { ws.close(1008, 'room full'); return; }
          peer.id = randomUUID();
          peer.role = 'viewer';
          viewers.set(peer.id, ws);
        }
        peer.authed = true;
        clearTimeout(authTimeout);
        send(ws, { type: 'welcome', peerId: peer.id, role: peer.role });
        if (peer.role === 'viewer' && host) send(host, { type: 'viewer-joined', peerId: peer.id });
        return;
      }
      if (msg.type === 'signal') {
        if (typeof msg.to !== 'string' || !isObject(msg.data) || typeof msg.data.kind !== 'string') return error(ws, 'BAD_SIGNAL');
        const kind = msg.data.kind;
        if (!['offer', 'answer', 'ice', 'ice-end', 'restart-request'].includes(kind)) return error(ws, 'BAD_SIGNAL_KIND');
        if (kind === 'offer' || kind === 'answer') {
          if (typeof msg.data.sdp !== 'string' || msg.data.sdp.length > 60_000) return error(ws, 'BAD_SDP');
        }
        if (kind === 'ice' && !isObject(msg.data.candidate)) return error(ws, 'BAD_CANDIDATE');
        const target = peer.role === 'host' ? viewers.get(msg.to) : (msg.to === 'host' ? host : null);
        if (!target || target.readyState !== WebSocket.OPEN) return error(ws, 'PEER_OFFLINE');
        send(target, { type: 'signal', from: peer.id, data: msg.data });
      } else if (msg.type === 'ping') {
        send(ws, { type: 'pong' });
      } else {
        error(ws, 'UNKNOWN_EVENT');
      }
    });
    ws.on('close', () => {
      clearTimeout(authTimeout);
      peers.delete(ws);
      if (!peer.authed) return;
      if (peer.role === 'host' && host === ws) {
        host = null;
        for (const viewer of viewers.values()) viewer.close(1001, 'host stopped');
        viewers.clear();
      } else if (peer.role === 'viewer') {
        viewers.delete(peer.id);
        if (host) send(host, { type: 'viewer-left', peerId: peer.id });
      }
    });
    ws.on('error', () => {});
  });

  try {
    await new Promise<void>((resolve, reject) => {
      const onError = (err: Error) => { wss.off('listening', onListening); reject(err); };
      const onListening = () => { wss.off('error', onError); resolve(); };
      wss.once('error', onError);
      wss.once('listening', onListening);
    });
  } catch (err) {
    wss.close();
    throw err;
  }

  // Discovery is optional: a firewall or VPN may block UDP broadcasts.
  const closeDiscovery = await startDiscoveryResponder(bindIp, port);
  return {
    discoveryEnabled: closeDiscovery !== null,
    async close() {
      if (closeDiscovery) await closeDiscovery();
      for (const socket of peers.keys()) socket.terminate();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
    }
  };
}
