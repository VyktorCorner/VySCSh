import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { RtcRoom } from './rtc';
import type { AdapterInfo, CaptureSourceInfo, DiscoveredHost, VideoQuality } from '../shared/types';

type Screen = 'home' | 'host' | 'client';
type Phase = 'idle' | 'starting' | 'active';
type IconName = 'cast' | 'monitor' | 'arrow' | 'back' | 'refresh' | 'network' | 'copy' | 'stop' | 'play' | 'settings' | 'check' | 'shield' | 'users' | 'plus';
const DEFAULT_PORT = 47892;
const RESOLUTIONS: Record<VideoQuality['resolution'], [number, number]> = {
  '720p': [1280, 720], '1080p': [1920, 1080], '1440p': [2560, 1440]
};

function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.65, strokeLinecap: 'square' as const, strokeLinejoin: 'miter' as const, 'aria-hidden': true as const };
  const drawing: Record<IconName, ReactNode> = {
    cast: <><rect x="2.5" y="3.5" width="19" height="13" /><path d="M7 20.5h10M12 16.5v4M5 8h.01" /></>,
    monitor: <><rect x="2.5" y="4" width="19" height="14" /><path d="M8 21h8M12 18v3M7.5 9.5h9" /></>,
    arrow: <><path d="M3 12h17m-7-7 7 7-7 7" /></>,
    back: <><path d="M21 12H4m7-7-7 7 7 7" /></>,
    refresh: <><path d="M20 8a8 8 0 0 0-14-2L3 9m0-6v6h6M4 16a8 8 0 0 0 14 2l3-3m0 6v-6h-6" /></>,
    network: <><circle cx="12" cy="12" r="2" /><path d="M5 8a10 10 0 0 1 14 0M2 5a14 14 0 0 1 20 0M8 16l4 4 4-4" /></>,
    copy: <><rect x="8" y="8" width="12" height="13" /><path d="M16 8V3H4v13h4" /></>,
    stop: <><rect x="5" y="5" width="14" height="14" /></>,
    play: <><path d="m7 4 13 8-13 8V4Z" /></>,
    settings: <><path d="M3 7h18M3 17h18" /><circle cx="9" cy="7" r="3" fill="#000" /><circle cx="16" cy="17" r="3" fill="#000" /></>,
    check: <><path d="m4 12 5 5L20 6" /></>,
    shield: <><path d="M12 2 4 5v7c0 5 4 8 8 10 4-2 8-5 8-10V5l-8-3Z" /><path d="m8.5 12 2.4 2.4 4.7-4.7" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M2 21v-2a7 7 0 0 1 14 0v2M17 5a3 3 0 0 1 0 6m2 10h3v-2a6 6 0 0 0-4-5.6" /></>
    ,plus: <><path d="M12 5v14M5 12h14" /></>
  };
  return <svg {...common}>{drawing[name]}</svg>;
}
function makeRoomKey(): string {
  const bytes = new Uint8Array(16); crypto.getRandomValues(bytes);
  return Array.from(bytes, (v) => v.toString(16).padStart(2, '0')).join('');
}
function validIPv4(ip: string): boolean {
  const parts = ip.split('.');
  return parts.length === 4 && parts.every((v) => /^\d{1,3}$/.test(v) && Number(v) <= 255);
}

export function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [phase, setPhase] = useState<Phase>('idle');
  const [adapters, setAdapters] = useState<AdapterInfo[]>([]);
  const [sources, setSources] = useState<CaptureSourceInfo[]>([]);
  const [bindIp, setBindIp] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [withAudio, setWithAudio] = useState(false);
  const [quality, setQuality] = useState<VideoQuality>({ resolution: '1080p', fps: 60, bitrateMbps: 6 });
  const [serverIp, setServerIp] = useState('');
  const [serverPort, setServerPort] = useState(String(DEFAULT_PORT));
  const [roomKey, setRoomKey] = useState(() => makeRoomKey());
  const [viewerKey, setViewerKey] = useState('');
  const [hosts, setHosts] = useState<DiscoveredHost[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [discoveredOnce, setDiscoveredOnce] = useState(false);
  const [hostDiscovery, setHostDiscovery] = useState(false);
  const [manualClient, setManualClient] = useState(false);
  const [connectedHostName, setConnectedHostName] = useState('');
  const [message, setMessage] = useState('Pronto para conectar.');
  const [logs, setLogs] = useState<string[]>([]);
  const [viewerCount, setViewerCount] = useState(0);
  const [connectionState, setConnectionState] = useState('disconnected');
  const [stats, setStats] = useState<{ state: string; rttMs?: number; bitrateMbps?: number } | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<HTMLVideoElement>(null);
  const roomRef = useRef<RtcRoom | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const didHostRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanLock = useRef(false);

  const log = useCallback((value: string) => {
    setLogs((old) => [`${new Date().toLocaleTimeString('pt-BR')}  ${value}`, ...old].slice(0, 50));
  }, []);
  const refresh = useCallback(async () => {
    try {
      const [addresses, captures] = await Promise.all([window.vyscsh.listAdapters(), window.vyscsh.listSources()]);
      setAdapters(addresses);
      setSources(captures);
      setBindIp((prev) => addresses.some((a) => a.address === prev) ? prev : addresses.find((a) => a.radmin)?.address || addresses[0]?.address || '');
      setSourceId((prev) => captures.some((s) => s.id === prev) ? prev : captures[0]?.id || '');
    } catch (err) { setMessage(`Não foi possível listar as fontes: ${String(err)}`); }
  }, []);

  const scan = useCallback(async () => {
    if (scanLock.current) return;
    scanLock.current = true;
    setDiscovering(true);
    try { setHosts(await window.vyscsh.discoverHosts()); }
    catch (err) { log(`Descoberta indisponível: ${String(err)}`); }
    finally { scanLock.current = false; setDiscovering(false); setDiscoveredOnce(true); }
  }, [log]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (screen !== 'client' || phase !== 'idle') return;
    void scan();
    const interval = setInterval(() => { void scan(); }, 6000);
    return () => clearInterval(interval);
  }, [screen, phase, scan]);
  useEffect(() => { if (previewRef.current) previewRef.current.srcObject = localStream; }, [localStream, screen]);
  useEffect(() => {
    if (!playerRef.current) return;
    playerRef.current.srcObject = remoteStream;
    if (remoteStream) void playerRef.current.play().catch(() => setMessage('Clique em Reproduzir para iniciar o vídeo.'));
  }, [remoteStream, screen]);

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
    setHostDiscovery(false);
    setPhase('idle');
    setConnectionState('disconnected');
    setConnectedHostName('');
    if (screen === 'host') setRoomKey(makeRoomKey());
    setMessage('Sessão encerrada.');
  };

  const monitor = (room: RtcRoom) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      void room.statistics().then(({ peerCount, ...data }) => {
        setStats(data);
        setViewerCount(peerCount);
      }).catch(() => {});
    }, 2000);
  };

  const startHost = async () => {
    if (phase !== 'idle') return;
    if (!sourceId || !bindIp) { setMessage('Escolha uma fonte e uma interface de rede.'); return; }
    setPhase('starting');
    setMessage('Preparando captura...');
    try {
      await window.vyscsh.selectCapture(sourceId, withAudio);
      const [width, height] = RESOLUTIONS[quality.resolution];
      const media = await navigator.mediaDevices.getDisplayMedia({
        audio: withAudio,
        video: { frameRate: { ideal: quality.fps, max: quality.fps }, width: { ideal: width }, height: { ideal: height } }
      });
      streamRef.current = media;
      setLocalStream(media);
      const track = media.getVideoTracks()[0];
      if (!track) throw new Error('A captura não retornou um vídeo.');
      try {
        await track.applyConstraints({ width: { ideal: width }, height: { ideal: height }, frameRate: { ideal: quality.fps, max: quality.fps } });
      } catch (err) { log(`O sistema não aplicou todas as opções de captura: ${String(err)}`); }
      track.addEventListener('ended', () => { void stop(); }, { once: true });
      const settings = track.getSettings();
      log(`Captura: ${settings.width ?? '?'}×${settings.height ?? '?'} · ${settings.frameRate ?? '?'} FPS (efetivos).`);
      const result = await window.vyscsh.startHost({ bindIp, port: DEFAULT_PORT, accessKey: roomKey });
      setHostDiscovery(result.discoveryEnabled);
      didHostRef.current = true;
      const room = new RtcRoom(bindIp, DEFAULT_PORT, roomKey, 'host', callbacks(), media, quality);
      roomRef.current = room;
      await room.connect();
      monitor(room);
      setPhase('active');
      setMessage('Transmissão ativa. Envie o convite para quem vai assistir.');
      log(`Host ouvindo em ${bindIp}:${DEFAULT_PORT}`);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      await stop();
      setMessage(`Falha ao iniciar: ${error}`);
    }
  };

  const startClient = async (selectedIp = serverIp, selectedPort = serverPort) => {
    if (phase !== 'idle') return;
    const ip = selectedIp.trim();
    const port = Number(selectedPort);
    const key = viewerKey.trim().toLowerCase();
    if (!validIPv4(ip) || !Number.isInteger(port) || port < 1024 || port > 65535 || !/^[0-9a-f]{32}$/.test(key)) {
      setMessage('Informe um IP válido e a chave de 32 caracteres do host.');
      return;
    }
    setPhase('starting');
    setMessage('Conectando ao host...');
    try {
      const room = new RtcRoom(ip, port, key, 'viewer', callbacks());
      roomRef.current = room;
      await room.connect();
      monitor(room);
      setPhase('active');
      setManualClient(false);
      setMessage('Conectado. Aguardando vídeo do transmissor...');
      log(`Conectado ao host ${ip}:${port}`);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      await stop();
      setMessage(`Falha ao conectar: ${error}`);
    }
  };

  const parseInvite = (value: string) => {
    const invite = value.trim().match(/^((?:\d{1,3}\.){3}\d{1,3}):(\d{4,5})#([a-f0-9]{32})$/i);
    if (invite && validIPv4(invite[1])) {
      setServerIp(invite[1]); setServerPort(invite[2]); setViewerKey(invite[3].toLowerCase());
      setMessage('Convite reconhecido. Pronto para conectar.');
      return;
    }
    setViewerKey(value);
  };

  const go = (next: Screen) => {
    if (phase !== 'idle') return;
    setMessage('Pronto para conectar.');
    setScreen(next);
  };
  const selectedAdapter = adapters.find((adapter) => adapter.address === bindIp);
  const isBusy = phase !== 'idle';
  const invitation = `${bindIp}:${DEFAULT_PORT}#${roomKey}`;
  const statusLabel = phase === 'active' ? (screen === 'host' ? 'AO VIVO' : 'CONECTADO') : phase === 'starting' ? 'INICIANDO' : 'OFFLINE';

  return <div className="app-shell">
    <header className="app-header">
      <button className="brand" onClick={() => go('home')} aria-label="Voltar ao início" disabled={isBusy}>
        <span className="brand-symbol single"><span className="v-glyph">V</span></span>
      </button>
    </header>

    {screen === 'home' ? <main className="home">
      <div className="home-intro">
        <h1>VySCSh</h1>
      </div>
      <div className="mode-grid">
        <button className="mode-tile mode-host" onClick={() => go('host')}>
          <span className="tile-top"><Icon name="cast" size={40}/><span>HOST</span></span>
          <span className="tile-content"><strong>Transmitir</strong></span>
          <span className="tile-arrow"><Icon name="arrow" size={30}/></span>
        </button>
        <button className="mode-tile mode-client" onClick={() => go('client')}>
          <span className="tile-top"><Icon name="monitor" size={40}/><span>CLIENTE</span></span>
          <span className="tile-content"><strong>Assistir</strong></span>
          <span className="tile-arrow"><Icon name="arrow" size={30}/></span>
        </button>
      </div>
    </main> : <main className="workspace">
      <button className="back-link" aria-label="Voltar ao início" disabled={isBusy} onClick={() => go('home')}><Icon name="back" size={17}/></button>
      <div className="workspace-heading">
        <div>
          <h1>{screen === 'host' ? 'Transmitir' : 'Assistir'}</h1>
        </div>
        <div className={`workspace-state ${phase === 'active' ? 'is-live' : ''}`}><span className="live-dot" />{statusLabel}</div>
      </div>
      <div className={`workspace-grid ${screen === 'client' && phase === 'idle' ? 'client-browse' : ''}`}>
        <section className="config-column">
          {screen === 'host' ? <>
            <div className="surface">
              <div className="section-title"><span>01</span><h2>Captura</h2></div>
              <label className="field"><span>JANELA OU MONITOR</span><select value={sourceId} disabled={isBusy} onChange={(e) => setSourceId(e.target.value)}>
                {sources.length === 0 && <option value="">Nenhuma fonte encontrada</option>}
                {sources.map((s) => <option key={s.id} value={s.id}>{s.type === 'screen' ? 'MONITOR · ' : 'JANELA · '}{s.name}</option>)}
              </select></label>
              <div className="section-title secondary-title"><span>02</span><h2>Qualidade</h2></div>
              <div className="field"><span>RESOLUÇÃO</span><div className="segments three">
                {(['720p','1080p','1440p'] as const).map((res) => <button key={res} type="button" className={quality.resolution === res ? 'selected' : ''} disabled={isBusy} onClick={() => setQuality((q) => ({...q, resolution: res}))}>{res}</button>)}
              </div></div>
              <div className="field"><span>QUADROS POR SEGUNDO</span><div className="segments two">
                {([30, 60] as const).map((fps) => <button key={fps} type="button" className={quality.fps === fps ? 'selected' : ''} disabled={isBusy} onClick={() => setQuality((q) => ({...q, fps}))}>{fps} FPS</button>)}
              </div></div>
              <div className="field bitrate"><div className="range-heading"><span>BITRATE MÁXIMO</span><strong>{quality.bitrateMbps} <small>Mbps</small></strong></div>
                <input aria-label="Bitrate máximo" type="range" min={2} max={16} step={1} value={quality.bitrateMbps} disabled={isBusy} onChange={(e) => setQuality((q) => ({...q, bitrateMbps: Number(e.target.value)}))}/>
                <div className="range-labels"><span>2 Mbps</span><span>16 Mbps</span></div>
              </div>
              <label className="audio-row"><span><strong>Áudio do sistema</strong><small>Experimental · Windows</small></span><input type="checkbox" checked={withAudio} disabled={isBusy} onChange={(e) => setWithAudio(e.target.checked)}/><span className="switch" /></label>
              <details className="extra"><summary><Icon name="settings" size={17}/> REDE E OPÇÕES AVANÇADAS</summary>
                <label className="field"><span>INTERFACE DE REDE</span><select value={bindIp} disabled={isBusy} onChange={(e) => setBindIp(e.target.value)}>
                  {adapters.length === 0 && <option value="">Nenhuma interface IPv4</option>}
                  {adapters.map((a) => <option key={`${a.name}-${a.address}`} value={a.address}>{a.radmin ? 'RADMIN · ' : ''}{a.name} — {a.address}</option>)}
                </select></label>
                <div className="inline-meta">Porta TCP: <b>{DEFAULT_PORT}</b> · descoberta UDP: <b>47893</b></div>
                <button className="minor-button" disabled={isBusy} onClick={() => void refresh()}><Icon name="refresh" size={16}/> Atualizar fontes</button>
              </details>
              {selectedAdapter && !selectedAdapter.radmin && <div className="notice">Interface não identificada como Radmin. Para conectar por VPN, selecione o IP do adaptador Radmin em opções avançadas.</div>}
              <div className="action-area">{phase === 'idle'
                ? <button className="action-main" onClick={() => void startHost()}><Icon name="cast" size={21}/> INICIAR TRANSMISSÃO <Icon name="arrow" size={21}/></button>
                : <button className="action-stop" disabled={phase === 'starting'} onClick={() => void stop()}><Icon name="stop" size={19}/> ENCERRAR TRANSMISSÃO</button>}
              </div>
            </div>
            {phase === 'active' && <div className="surface invite-panel">
              <div className="section-title"><span>03</span><h2>Compartilhar acesso</h2></div>
              <div className="invite-address">{bindIp}:{DEFAULT_PORT}</div>
              <div className="secret-key">CHAVE · {roomKey}</div>
              <button className="outline-button" onClick={() => void window.vyscsh.copyText(invitation)}><Icon name="copy" size={17}/> COPIAR CONVITE</button>
              <p className="tiny-note">{hostDiscovery ? 'Descoberta ativa.' : 'Conexão manual.'}</p>
            </div>}
          </> : <>
            <div className={`surface client-browser ${manualClient ? 'manual-open' : ''}`}>
              {!manualClient ? <>
                <div className="client-toolbar">
                  <span className="client-label">TRANSMISSÕES</span>
                  <div className="client-toolbar-actions">
                    <button aria-label="Adicionar transmissão manualmente" className="add-control" disabled={isBusy} onClick={() => setManualClient(true)}><Icon name="plus" size={21}/></button>
                    <button aria-label="Atualizar transmissões" className={`refresh-control ${discovering ? 'spinning' : ''}`} disabled={discovering || isBusy} onClick={() => void scan()}><Icon name="refresh" size={17}/></button>
                  </div>
                </div>
                <div className="discovery-grid">
                  {hosts.map((host) => <button key={`${host.address}:${host.port}`} className={`discovered ${serverIp === host.address && Number(serverPort) === host.port ? 'chosen' : ''}`} disabled={isBusy} onClick={() => { setServerIp(host.address); setServerPort(String(host.port)); setConnectedHostName(host.name); if (/^[0-9a-f]{32}$/i.test(viewerKey.trim())) void startClient(host.address, String(host.port)); else setMessage('Adicione a chave da transmissão para conectar.'); }}>
                    <span className="found-icon"><Icon name="monitor" size={25}/></span>
                    <span className="found-info"><strong>{host.name}</strong><small>{host.address}</small></span>
                  </button>)}
                </div>
                {hosts.length === 0 && <div className="empty-discovery compact"><span>{discovering ? 'Procurando...' : 'Nenhuma transmissão encontrada'}</span></div>}
              </> : <>
                <div className="client-toolbar">
                  <button className="client-back" onClick={() => setManualClient(false)}><Icon name="back" size={17}/></button>
                  <span className="client-label">ADICIONAR TRANSMISSÃO</span>
                </div>
                <label className="field"><span>IP DO HOST</span><input value={serverIp} disabled={isBusy} placeholder="26.100.20.30" onChange={(e) => setServerIp(e.target.value)}/></label>
                <label className="field"><span>CHAVE</span><input type="password" value={viewerKey} disabled={isBusy} autoComplete="off" placeholder="Chave ou convite" onChange={(e) => parseInvite(e.target.value)} /></label>
                <details className="extra"><summary><Icon name="settings" size={17}/> PORTA</summary>
                  <label className="field"><input aria-label="Porta do host" type="number" value={serverPort} disabled={isBusy} min={1024} max={65535} onChange={(e) => setServerPort(e.target.value)}/></label>
                </details>
                <div className="action-area">{phase === 'idle'
                  ? <button className="action-main" onClick={() => void startClient()}><Icon name="play" size={20}/> CONECTAR</button>
                  : <button className="action-stop" disabled={phase === 'starting'} onClick={() => void stop()}><Icon name="stop" size={19}/> DESCONECTAR</button>}
                </div>
              </>}
            </div>
          </>}
        </section>
        {(screen === 'host' || phase !== 'idle' || Boolean(connectedHostName)) && <section className="player-column">
          <div className="player-surface">
            <div className="player-top"><span>{screen === 'host' ? 'PRÉVIA LOCAL' : connectedHostName || 'PLAYER REMOTO'}</span><span className={`player-status ${phase === 'active' ? 'lit' : ''}`}><i/>{statusLabel}</span></div>
            <div className="player-stage">
              {screen === 'host' ? <video ref={previewRef} autoPlay muted playsInline /> : <video ref={playerRef} autoPlay controls playsInline />}
              {!(screen === 'host' ? localStream : remoteStream) && <div className="player-placeholder"><div className="placeholder-symbol"><Icon name="monitor" size={68}/></div><span>{screen === 'host' ? 'PRÉVIA DA SUA TELA' : 'AGUARDANDO VÍDEO'}</span><small>{screen === 'host' ? 'A imagem aparece aqui quando a transmissão começa.' : 'Selecione uma transmissão para assistir.'}</small></div>}
            </div>
            <div className="player-bottom"><span>{message}</span>{screen === 'client' && phase === 'idle' && connectedHostName && <button className="minor-button" onClick={() => setManualClient(true)}>Adicionar chave</button>}{screen === 'client' && phase === 'active' && <div className="player-actions">
              <button className="minor-button" onClick={() => void playerRef.current?.play()}><Icon name="play" size={15}/> Reproduzir</button>
              <button className="minor-button" onClick={() => { const video = playerRef.current; if (!video) return; void (document.fullscreenElement ? document.exitFullscreen() : video.requestFullscreen()).catch(() => setMessage('Tela cheia não disponível.')); }}>Tela cheia</button>
              <button className="minor-button" onClick={() => { const video = playerRef.current; if (!video?.requestPictureInPicture) { setMessage('Picture-in-Picture não disponível.'); return; } void video.requestPictureInPicture().catch(() => setMessage('Picture-in-Picture não disponível.')); }}>PIP</button>
            </div>}</div>
          </div>
          <div className="metrics">
            <div><span>CONEXÃO</span><strong>{connectionState === 'connected' ? 'Conectado' : connectionState === 'connecting' ? 'Conectando' : connectionState === 'disconnected' ? 'Desconectado' : connectionState}</strong></div>
            <div><span>ESPECTADORES</span><strong>{screen === 'host' ? viewerCount : '—'}</strong></div>
            <div><span>RTT</span><strong>{stats?.rttMs == null ? '—' : `${stats.rttMs} ms`}</strong></div>
            <div><span>WEBRTC</span><strong>{stats?.state || '—'}</strong></div>
          </div>
          <details className="event-drawer"><summary>LOGS TÉCNICOS <span>VER EVENTOS</span></summary><div className="event-content">{logs.length === 0 ? 'Nenhum evento registrado.' : logs.map((line, i) => <div key={`${i}-${line}`}>{line}</div>)}</div></details>
        </section>}
      </div>
    </main>}
  </div>;
}
