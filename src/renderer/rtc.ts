import type { SignalBody } from '../shared/types';

type Role = 'host' | 'viewer';
type Status = 'connecting' | 'connected' | 'disconnected' | 'failed';
type Callbacks = {
  onLog(text: string): void;
  onStatus(status: Status): void;
  onViewerCount(count: number): void;
  onRemoteStream(stream: MediaStream | null): void;
};

type SignalEnvelope = {
  type: string;
  peerId?: string;
  from?: string;
  code?: string;
  data?: SignalBody;
};

export class RtcRoom {
  private socket: WebSocket | null = null;
  private peers = new Map<string, RTCPeerConnection>();
  private queuedCandidates = new Map<string, RTCIceCandidateInit[]>();
  private restartCount = new Map<string, number>();
  private closed = false;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private ownId = '';

  constructor(
    private readonly ip: string,
    private readonly port: number,
    private readonly accessKey: string,
    private readonly role: Role,
    private readonly callbacks: Callbacks,
    private readonly localStream?: MediaStream
  ) {}

  async connect(): Promise<void> {
    this.closed = false;
    this.callbacks.onStatus('connecting');
    const ws = new WebSocket(`ws://${this.ip}:${this.port}`);
    this.socket = ws;
    await new Promise<void>((resolve, reject) => {
      let completed = false;
      const timeout = setTimeout(() => fail(new Error('Tempo de conexão excedido (12s).')), 12_000);
      const fail = (cause: Error) => {
        if (completed) return;
        completed = true;
        clearTimeout(timeout);
        reject(cause);
        ws.close();
      };
      ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', role: this.role, key: this.accessKey }));
      ws.onerror = () => fail(new Error('Falha ao conectar. Confira Radmin, IP, porta e firewall.'));
      ws.onclose = (event) => {
        if (!completed) fail(new Error(`Servidor recusou conexão (${event.code}): ${event.reason || 'sem detalhes'}`));
        else if (!this.closed) {
          this.callbacks.onLog('Conexão com o servidor encerrada.');
          this.closePeers();
          this.callbacks.onStatus('disconnected');
        }
      };
      ws.onmessage = (event: MessageEvent<string>) => {
        let message: SignalEnvelope;
        try { message = JSON.parse(event.data) as SignalEnvelope; }
        catch { return; }
        if (message.type === 'welcome' && message.peerId && !completed) {
          completed = true;
          clearTimeout(timeout);
          this.ownId = message.peerId;
          this.callbacks.onStatus('connected');
          this.callbacks.onLog(this.role === 'host' ? 'Sala pronta. Aguardando espectadores.' : 'Conectado ao host. Negociando vídeo...');
          resolve();
          return;
        }
        if (message.type === 'error') {
          const reason = String(message.code || 'UNKNOWN');
          if (!completed) fail(new Error(`Erro de sinalização: ${reason}`));
          else this.callbacks.onLog(`Servidor: ${reason}`);
          return;
        }
        if (message.type === 'viewer-joined' && this.role === 'host' && message.peerId) {
          void this.offerTo(message.peerId).catch((e) => this.callbacks.onLog(`Erro ao negociar: ${String(e)}`));
          return;
        }
        if (message.type === 'viewer-left' && message.peerId) {
          this.dropPeer(message.peerId);
          return;
        }
        if (message.type === 'signal' && message.from && message.data) {
          void this.handleSignal(message.from, message.data).catch((e) => {
            this.callbacks.onLog(`Falha no WebRTC: ${e instanceof Error ? e.message : String(e)}`);
          });
        }
      };
    });
    this.heartbeat = setInterval(() => this.send({ type: 'ping' }), 20_000);
  }

  private send(message: Record<string, unknown>) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  private signal(peerId: string, data: SignalBody) {
    this.send({ type: 'signal', to: peerId, data });
  }

  private ensurePeer(id: string): RTCPeerConnection {
    const existing = this.peers.get(id);
    if (existing) return existing;
    // Radmin supplies the virtual network. No public STUN or TURN is required in this MVP.
    const pc = new RTCPeerConnection({ iceServers: [], iceTransportPolicy: 'all' });
    this.peers.set(id, pc);
    this.queuedCandidates.set(id, []);
    pc.onicecandidate = (event) => {
      if (event.candidate) this.signal(id, { kind: 'ice', candidate: event.candidate.toJSON() });
      else this.signal(id, { kind: 'ice-end' });
    };
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'connected') {
        this.callbacks.onLog(`Peer ${id.slice(0, 8)}: conectado.`);
        this.restartCount.delete(id);
      }
      if (state === 'failed' && this.role === 'host') void this.tryRestart(id, pc);
      if (state === 'closed') this.dropPeer(id);
    };
    pc.ontrack = (event) => {
      if (this.role === 'viewer') {
        const stream = event.streams[0] || new MediaStream([event.track]);
        this.callbacks.onRemoteStream(stream);
      }
    };
    if (this.role === 'host' && this.localStream) {
      for (const track of this.localStream.getTracks()) {
        const sender = pc.addTrack(track, this.localStream);
        if (track.kind === 'video') {
          const params = sender.getParameters();
          if (params.encodings?.length) {
            params.encodings[0].maxBitrate = 6_000_000;
            params.encodings[0].maxFramerate = 60;
            void sender.setParameters(params).catch(() => {});
          }
        }
      }
    }
    this.callbacks.onViewerCount(this.peers.size);
    return pc;
  }

  private async offerTo(peerId: string) {
    if (this.role !== 'host' || !this.localStream) return;
    const pc = this.ensurePeer(peerId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.signal(peerId, { kind: 'offer', sdp: offer.sdp || '' });
  }

  private async applyPending(id: string, pc: RTCPeerConnection) {
    const queue = this.queuedCandidates.get(id) || [];
    this.queuedCandidates.set(id, []);
    for (const candidate of queue) await pc.addIceCandidate(candidate).catch(() => {});
  }

  private async handleSignal(peerId: string, signal: SignalBody): Promise<void> {
    if (signal.kind === 'offer') {
      if (this.role !== 'viewer' || peerId !== 'host') return;
      const pc = this.ensurePeer(peerId);
      if (pc.signalingState !== 'stable') {
        // Viewer is the polite peer; roll back before applying competing offer.
        await pc.setLocalDescription({ type: 'rollback' });
      }
      await pc.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
      await this.applyPending(peerId, pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.signal(peerId, { kind: 'answer', sdp: answer.sdp || '' });
    } else if (signal.kind === 'answer') {
      if (this.role !== 'host') return;
      const pc = this.peers.get(peerId);
      if (pc && pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
        await this.applyPending(peerId, pc);
      }
    } else if (signal.kind === 'ice') {
      const pc = this.ensurePeer(peerId);
      if (pc.remoteDescription) await pc.addIceCandidate(signal.candidate).catch(() => {});
      else this.queuedCandidates.get(peerId)?.push(signal.candidate);
    } else if (signal.kind === 'restart-request' && this.role === 'host') {
      const pc = this.peers.get(peerId);
      if (pc) await this.tryRestart(peerId, pc);
    }
  }

  private async tryRestart(id: string, pc: RTCPeerConnection) {
    const attempts = this.restartCount.get(id) || 0;
    if (attempts >= 2) { this.callbacks.onLog(`Peer ${id.slice(0, 8)}: ICE falhou. Verifique a rota Radmin.`); return; }
    if (pc.signalingState !== 'stable') return;
    this.restartCount.set(id, attempts + 1);
    this.callbacks.onLog(`Peer ${id.slice(0, 8)}: ICE restart ${attempts + 1}/2`);
    try {
      pc.restartIce();
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      this.signal(id, { kind: 'offer', sdp: offer.sdp || '' });
    } catch (err) { this.callbacks.onLog(`Falha ao reiniciar ICE: ${String(err)}`); }
  }

  private dropPeer(id: string) {
    const pc = this.peers.get(id);
    if (!pc) return;
    this.peers.delete(id);
    this.queuedCandidates.delete(id);
    this.restartCount.delete(id);
    pc.onconnectionstatechange = null;
    pc.close();
    if (this.role === 'viewer') this.callbacks.onRemoteStream(null);
    this.callbacks.onViewerCount(this.peers.size);
  }

  private closePeers() { for (const id of [...this.peers.keys()]) this.dropPeer(id); }

  async statistics(): Promise<{ peerCount: number; state: string; rttMs?: number; bitrateMbps?: number }> {
    const pc = [...this.peers.values()][0];
    if (!pc) return { peerCount: 0, state: 'Aguardando peer' };
    const stats = await pc.getStats();
    let rttMs: number | undefined;
    let bitrateMbps: number | undefined;
    stats.forEach((report) => {
      if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.currentRoundTripTime !== undefined) {
        rttMs = Math.round(report.currentRoundTripTime * 1000);
      }
      if (report.type === 'outbound-rtp' && report.kind === 'video' && report.targetBitrate) bitrateMbps = report.targetBitrate / 1_000_000;
    });
    return { peerCount: this.peers.size, state: pc.connectionState, rttMs, bitrateMbps };
  }

  close() {
    this.closed = true;
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.closePeers();
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close();
      this.socket = null;
    }
    this.callbacks.onStatus('disconnected');
  }
}
