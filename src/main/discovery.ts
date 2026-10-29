/** Best-effort UDP discovery on the host's LAN / VPN interface.
 * Discovery never authenticates peers or advertises the room key.
 */
import os from 'node:os';
import dgram from 'node:dgram';
import { isIP } from 'node:net';
import type { DiscoveredHost } from '../shared/types';

export const DISCOVERY_PORT = 47893;
const MAGIC = 'VySCSh:discovery';
const VERSION = 1;
const MAX_PAYLOAD = 512;

function ipAsNumber(ip: string): number {
  return ip.split('.').reduce((n, octet) => ((n << 8) | Number(octet)) >>> 0, 0);
}

function onSubnet(remoteIp: string, localIp: string, netmask: string): boolean {
  if (isIP(remoteIp) !== 4 || isIP(localIp) !== 4 || isIP(netmask) !== 4) return false;
  const mask = ipAsNumber(netmask);
  return (ipAsNumber(remoteIp) & mask) === (ipAsNumber(localIp) & mask);
}

function networkFor(ip: string): { mask: string; name: string } | null {
  for (const [name, addresses] of Object.entries(os.networkInterfaces())) {
    for (const a of addresses ?? []) {
      if (a.family === 'IPv4' && a.address === ip) return { mask: a.netmask, name };
    }
  }
  return null;
}

function broadcastTargets(): string[] {
  const targets = new Set<string>(['255.255.255.255']);
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const a of addresses ?? []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      const addr = ipAsNumber(a.address);
      const mask = ipAsNumber(a.netmask);
      const broadcast = (addr | (~mask >>> 0)) >>> 0;
      targets.add([24, 16, 8, 0].map((shift) => (broadcast >>> shift) & 255).join('.'));
    }
  }
  return [...targets];
}

/** Hosts reply only to senders on the same subnet as the selected bind address. */
export async function startDiscoveryResponder(bindIp: string, port: number): Promise<(() => Promise<void>) | null> {
  const network = networkFor(bindIp);
  if (!network) return null;
  const socket = dgram.createSocket('udp4');
  const started = await new Promise<boolean>((resolve) => {
    socket.once('error', () => resolve(false));
    socket.bind(DISCOVERY_PORT, '0.0.0.0', () => resolve(true));
  });
  if (!started) { try { socket.close(); } catch { /* already closed */ } return null; }
  socket.on('error', () => { /* discovery must not crash signaling */ });
  const lastReply = new Map<string, number>();
  socket.on('message', (data, sender) => {
    if (data.length > MAX_PAYLOAD || !onSubnet(sender.address, bindIp, network.mask)) return;
    let packet: unknown;
    try { packet = JSON.parse(data.toString('utf8')); } catch { return; }
    if (!packet || typeof packet !== 'object') return;
    const request = packet as Record<string, unknown>;
    if (request.magic !== MAGIC || request.version !== VERSION || request.kind !== 'search') return;
    const now = Date.now();
    if (now - (lastReply.get(sender.address) ?? 0) < 1000) return;
    if (lastReply.size > 256) lastReply.clear();
    lastReply.set(sender.address, now);
    const reply = Buffer.from(JSON.stringify({
      magic: MAGIC, version: VERSION, kind: 'announce', name: os.hostname().slice(0, 48),
      port, via: /radmin/i.test(network.name) ? 'radmin' : 'lan'
    }));
    socket.send(reply, sender.port, sender.address, () => {});
  });
  return async () => {
    await new Promise<void>((resolve) => { try { socket.close(() => resolve()); } catch { resolve(); } });
  };
}

/** Discovery is best-effort. Some Radmin configurations do not carry UDP broadcast. */
export async function discoverHosts(timeoutMs = 1400): Promise<DiscoveredHost[]> {
  const socket = dgram.createSocket('udp4');
  const found = new Map<string, DiscoveredHost>();
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      const result = [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
      try { socket.close(() => resolve(result)); } catch { resolve(result); }
    };
    const timeout = setTimeout(finish, Math.max(300, Math.min(timeoutMs, 4000)));
    socket.on('error', () => { clearTimeout(timeout); finish(); });
    socket.on('message', (data, sender) => {
      if (data.length > MAX_PAYLOAD || isIP(sender.address) !== 4) return;
      let packet: unknown;
      try { packet = JSON.parse(data.toString('utf8')); } catch { return; }
      if (!packet || typeof packet !== 'object') return;
      const reply = packet as Record<string, unknown>;
      if (reply.magic !== MAGIC || reply.version !== VERSION || reply.kind !== 'announce' ||
          typeof reply.name !== 'string' || typeof reply.port !== 'number' ||
          !Number.isInteger(reply.port) || reply.port < 1024 || reply.port > 65535) return;
      found.set(`${sender.address}:${reply.port}`, {
        address: sender.address, port: reply.port,
        name: reply.name.slice(0, 48),
        via: reply.via === 'radmin' ? 'radmin' : 'lan'
      });
    });
    socket.bind(0, '0.0.0.0', () => {
      try {
        socket.setBroadcast(true);
        const search = Buffer.from(JSON.stringify({ magic: MAGIC, version: VERSION, kind: 'search' }));
        for (const target of broadcastTargets()) socket.send(search, DISCOVERY_PORT, target, () => {});
      } catch { clearTimeout(timeout); finish(); }
    });
  });
}
