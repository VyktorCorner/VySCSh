export interface AdapterInfo {
  name: string;
  address: string;
  radmin: boolean;
}

export interface DiscoveredHost {
  name: string;
  address: string;
  port: number;
  via: 'radmin' | 'lan';
}

export interface VideoQuality {
  resolution: '720p' | '1080p' | '1440p';
  fps: 30 | 60;
  bitrateMbps: number;
}

export interface CaptureSourceInfo {
  id: string;
  name: string;
  type: 'screen' | 'window';
}

export interface HostOptions {
  bindIp: string;
  port: number;
  accessKey: string;
}

export interface ClientBridge {
  listAdapters(): Promise<AdapterInfo[]>;
  listSources(): Promise<CaptureSourceInfo[]>;
  discoverHosts(): Promise<DiscoveredHost[]>;
  selectCapture(id: string, systemAudio: boolean): Promise<void>;
  startHost(options: HostOptions): Promise<{ ip: string; port: number; discoveryEnabled: boolean }>;
  stopHost(): Promise<void>;
  copyText(value: string): Promise<void>;
}

export type SignalBody =
  | { kind: 'offer' | 'answer'; sdp: string }
  | { kind: 'ice'; candidate: RTCIceCandidateInit }
  | { kind: 'ice-end' }
  | { kind: 'restart-request' };
