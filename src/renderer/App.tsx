import React, { useEffect, useRef, useState } from 'react';
import { RtcRoom } from './rtc';
import type { AdapterInfo, CaptureSourceInfo } from '../shared/types';

type Role = 'host' | 'viewer';
type Phase = 'idle' | 'starting' | 'active';
const DEFAULT_PORT = 47892;

function newRoomKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

export function App() {
  const [role, setRole] = useState<Role>('host');
  const [phase, setPhase] = useState<Phase>('idle');
  const [adapters, setAdapters] = useState<AdapterInfo[]>([]);
  const [sources, setSources] = useState<CaptureSourceInfo[]>([]);
  const [bindIp, setBindIp] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [withAudio, setWithAudio] = useState(false);
  const [serverIp, setServerIp] = useState('');
  const [serverPort, setServerPort] = useState(String(DEFAULT_PORT));
  const [port, setPort] = useState(String(DEFAULT_PORT));
  const [roomKey, setRoomKey] = useState(() => newRoomKey());
  const [viewerKey, setViewerKey] = useState('');
  const [message, setMessage] = useState('Pronto para conectar');
  const [logs, setLogs] = useState<string[]>([]);
  const [viewerCount, setViewerCount] = useState(0);
  const [connectionState, setConnectionState] = useState('Desconectado');
  const [stats, setStats] = useState<{ state: string; rttMs?: number; bitrateMbps?: number } | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<HTMLVideoElement>(null);
  const roomRef = useRef<RtcRoom | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const didHostRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const log = (value: string) => setLogs((old) => [`${new Date().toLocaleTimeString('pt-BR')}  ${value}`, ...old].slice(0, 30));

  const refresh = async () => {
    try {
      const [addresses, captures] = await Promise.all([window.vyscsh.listAdapters(), window.vyscsh.listSources()]);
      setAdapters(addresses);
      setSources(captures);
      setBindIp((old) => old || addresses.find((a) => a.radmin)?.address || addresses[0]?.address || '');
      setSourceId((old) => captures.some((s) => s.id === old) ? old : (captures[0]?.id || ''));
    } catch (err) { setMessage(`Erro ao listar dispositivos: ${String(err)}`); }
  };

  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    if (previewRef.current) previewRef.current.srcObject = localStream;
  }, [localStream]);
  useEffect(() => {
    if (!playerRef.current) return;
    playerRef.current.srcObject = remoteStream;
    if (remoteStream) void playerRef.current.play().catch(() => setMessage('Clique em Reproduzir para liberar o vídeo/áudio.'));
  }, [remoteStream]);

  const callbacks = () => ({
    onLog: log,
    onStatus: (value: string) => setConnectionState(value),
    onViewerCount: setViewerCount,
    onRemoteStream: setRemoteStream
  });

  const stop = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    roomRef.current?.close();
    roomRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    if (didHostRef.current) {
      try { await window.vyscsh.stopHost(); } catch (e) { log(String(e)); }
      didHostRef.current = false;
    }
    setViewerCount(0);
    setStats(null);
    setPhase('idle');
    if (role === 'host') setRoomKey(newRoomKey());
    setMessage('Sessão encerrada.');
  };

  const monitor = (room: RtcRoom) => {
    timerRef.current = setInterval(() => {
      void room.statistics().then(({ peerCount, ...data }) => {
        setStats(data);
        setViewerCount(peerCount);
      }).catch(() => {});
    }, 2000);
  };

  const startHost = async () => {
    if (phase !== 'idle') return;
    if (!sourceId || !bindIp) { setMessage('Selecione uma fonte e um IP de rede.'); return; }
    const chosenPort = Number(port);
    if (!Number.isInteger(chosenPort) || chosenPort < 1024 || chosenPort > 65535) { setMessage('Porta inválida.'); return; }
    setPhase('starting');
    setMessage('Iniciando captura...');
    try {
      await window.vyscsh.selectCapture(sourceId, withAudio);
      const media = await navigator.mediaDevices.getDisplayMedia({ audio: withAudio, video: { frameRate: 60 } });
      streamRef.current = media;
      setLocalStream(media);
      const videoTrack = media.getVideoTracks()[0];
      if (!videoTrack) throw new Error('Captura não produziu trilha de vídeo.');
      videoTrack.addEventListener('ended', () => { void stop(); }, { once: true });
      await window.vyscsh.startHost({ bindIp, port: chosenPort, accessKey: roomKey });
      didHostRef.current = true;
      const room = new RtcRoom(bindIp, chosenPort, roomKey, 'host', callbacks(), media);
      roomRef.current = room;
      await room.connect();
      monitor(room);
      setPhase('active');
      setMessage('Transmitindo. Compartilhe IP, porta e chave com o espectador.');
      log(`Servidor iniciado em ${bindIp}:${chosenPort}`);
    } catch (err) {
      setMessage(`Não foi possível iniciar: ${err instanceof Error ? err.message : String(err)}`);
      await stop();
      setMessage(`Falha ao iniciar: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const startViewer = async () => {
    if (phase !== 'idle') return;
    const ip = serverIp.trim();
    const p = Number(serverPort);
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip) || !ip.split('.').every((v) => Number(v) <= 255) ||
        !Number.isInteger(p) || p < 1024 || p > 65535 || !/^[0-9a-f]{32}$/i.test(viewerKey.trim())) {
      setMessage('Confira IP IPv4, porta e chave de 32 caracteres recebida do host.');
      return;
    }
    setPhase('starting');
    setMessage('Conectando à sala...');
    try {
      const room = new RtcRoom(ip, p, viewerKey.trim().toLowerCase(), 'viewer', callbacks());
      roomRef.current = room;
      await room.connect();
      monitor(room);
      setPhase('active');
      setMessage('Aguardando a negociação do vídeo com o host...');
      log(`Sala encontrada em ${ip}:${p}`);
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      await stop();
      setMessage(`Falha ao entrar: ${text}`);
    }
  };

  const isActive = phase !== 'idle';
  const radminDetected = adapters.some((a) => a.radmin);
  const selectedAdapter = adapters.find((a) => a.address === bindIp);

  return <div className="shell">
    <aside className="side">
      <div className="brand"><div className="brand-mark">V</div><div><strong>VySCSh</strong><small>STREAMING / DEV BUILD 0.1</small></div></div>
      <div className="nav-caption">MODO DE OPERAÇÃO</div>
      <button className={`nav ${role === 'host' ? 'active' : ''}`} disabled={isActive} onClick={() => setRole('host')}><span>▣</span> Hospedar transmissão</button>
      <button className={`nav ${role === 'viewer' ? 'active' : ''}`} disabled={isActive} onClick={() => setRole('viewer')}><span>▷</span> Assistir transmissão</button>
      <div className="side-bottom"><div className={`dot ${radminDetected ? 'green' : ''}`}></div><div><strong>{radminDetected ? 'Radmin detectado' : 'Radmin não detectado'}</strong><small>{radminDetected ? 'Adaptador virtual disponível' : 'Instale/conecte antes do teste'}</small></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><div><h1>{role === 'host' ? 'Compartilhar tela' : 'Assistir transmissão'}</h1><p>Conexão privada entre PCs Windows via Radmin VPN e WebRTC.</p></div><div className="version">MVP • v0.1.0</div></header>
      <div className="main-grid">
        <section className="left-column">
          {role === 'host' ? <div className="panel">
            <div className="panel-title"><span>01</span><h2>Configurar host</h2></div>
            <label>Interface de rede</label>
            <select value={bindIp} disabled={isActive} onChange={(e) => setBindIp(e.target.value)}>
              {adapters.length === 0 && <option value="">Nenhuma interface IPv4 encontrada</option>}
              {adapters.map((a) => <option key={`${a.name}-${a.address}`} value={a.address}>{a.radmin ? '● RADMIN · ' : ''}{a.name} — {a.address}</option>)}
            </select>
            {selectedAdapter && !selectedAdapter.radmin && <div className="hint warn">A interface selecionada não foi identificada como Radmin. Use a rede virtual para testes entre casas.</div>}
            <div className="two-fields"><div><label>Porta do signaling</label><input type="number" value={port} disabled={isActive} min="1024" max="65535" onChange={(e) => setPort(e.target.value)} /></div><div><label>Áudio do sistema</label><label className="toggle"><input type="checkbox" checked={withAudio} disabled={isActive} onChange={(e) => setWithAudio(e.target.checked)} /> Incluir áudio (beta)</label></div></div>
            <label>Janela ou monitor</label>
            <select value={sourceId} disabled={isActive} onChange={(e) => setSourceId(e.target.value)}>
              {sources.length === 0 && <option value="">Nenhuma fonte encontrada</option>}
              {sources.map((s) => <option key={s.id} value={s.id}>{s.type === 'screen' ? '🖥' : '▣'} {s.name}</option>)}
            </select>
            <button className="ghost small" disabled={isActive} onClick={() => void refresh()}>↻ Atualizar fontes e redes</button>
            {phase === 'active' && <div className="share-block"><div className="share-head">DADOS PARA O ESPECTADOR</div><div>IP: <strong>{bindIp}</strong> · Porta: <strong>{port}</strong></div><div className="key-line">Chave: <code>{roomKey}</code></div><button className="ghost small" onClick={() => void window.vyscsh.copyText(`${bindIp}:${port}\n${roomKey}`)}>Copiar endereço e chave</button></div>}
            <div className="actions">{phase === 'idle' ? <button className="primary" onClick={() => void startHost()}>● Criar sala e transmitir</button> : <button className="danger" disabled={phase === 'starting'} onClick={() => void stop()}>■ Encerrar transmissão</button>}</div>
          </div> : <div className="panel">
            <div className="panel-title"><span>01</span><h2>Entrar na sala</h2></div>
            <p className="subnote">Os dois computadores precisam estar conectados à mesma rede do Radmin VPN.</p>
            <label>IP Radmin do host</label>
            <input value={serverIp} disabled={isActive} placeholder="Ex.: 26.12.34.56" onChange={(e) => setServerIp(e.target.value)} />
            <label>Porta</label>
            <input type="number" value={serverPort} disabled={isActive} min="1024" max="65535" onChange={(e) => setServerPort(e.target.value)} />
            <label>Chave da sala</label>
            <input value={viewerKey} disabled={isActive} autoComplete="off" placeholder="Cole a chave de 32 caracteres" onChange={(e) => setViewerKey(e.target.value)} />
            <div className="actions">{phase === 'idle' ? <button className="primary" onClick={() => void startViewer()}>▷ Conectar à transmissão</button> : <button className="danger" disabled={phase === 'starting'} onClick={() => void stop()}>■ Desconectar</button>}</div>
          </div>}
          <div className="panel compact"><div className="panel-title"><span>02</span><h2>Conexão</h2></div><div className="stat-grid"><div><small>Status</small><strong>{connectionState}</strong></div><div><small>Peers</small><strong>{viewerCount}</strong></div><div><small>RTT WebRTC</small><strong>{stats?.rttMs !== undefined ? `${stats.rttMs} ms` : '—'}</strong></div><div><small>ICE / DTLS</small><strong>{stats?.state || '—'}</strong></div></div></div>
          <div className="panel compact log-panel"><div className="panel-title"><span>03</span><h2>Eventos</h2></div><div className="logs">{logs.length ? logs.map((line, i) => <div key={`${i}-${line}`}>{line}</div>) : 'Nenhum evento ainda.'}</div></div>
        </section>
        <section className="right-column"><div className="panel player-panel"><div className="player-heading"><h2>{role === 'host' ? 'Prévia da captura' : 'Player remoto'}</h2><div className={`state-pill ${phase === 'active' ? 'live' : ''}`}>{phase === 'active' ? (role === 'host' ? '● AO VIVO' : '● CONECTADO') : '○ OFFLINE'}</div></div>
          <div className="video-wrap">{role === 'host' ? <video autoPlay muted playsInline ref={previewRef} /> : <video autoPlay controls playsInline ref={playerRef} />}{!(role === 'host' ? localStream : remoteStream) && <div className="empty-player"><div className="screen-icon">▣</div><strong>{role === 'host' ? 'Aguardando captura' : 'Sem vídeo disponível'}</strong><small>{role === 'host' ? 'Escolha uma janela e inicie a transmissão' : 'Entre na sala e aguarde o transmissor'}</small></div>}</div>
          {role === 'viewer' && phase === 'active' && <button className="ghost small" onClick={() => void playerRef.current?.play()}>▷ Reproduzir / liberar áudio</button>}
          <div className="player-footer"><span>{message}</span><span>{role === 'host' ? 'P2P · SEM GRAVAÇÃO' : 'WEBRTC · RADMIN'}</span></div>
        </div><div className="hint-block"><strong>Como funciona</strong><p>O host abre o servidor de sinalização no próprio PC e compartilha IP/porta/chave. O espectador conecta por Radmin e recebe áudio/vídeo em uma conexão WebRTC P2P. Nenhuma mídia é armazenada.</p></div></section>
      </div>
    </main>
  </div>;
}
