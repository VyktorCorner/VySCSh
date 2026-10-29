export interface AdapterInfo {
  name: string;
  address: string;
  radmin: boolean;
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
  selectCapture(id: string, systemAudio: boolean): Promise<void>;
  startHost(options: HostOptions): Promise<{ ip: string; port: number }>;
  stopHost(): Promise<void>;
  copyText(value: string): Promise<void>;
}

export type SignalBody =
  | { kind: 'offer' | 'answer'; sdp: string }
  | { kind: 'ice'; candidate: RTCIceCandidateInit }
  | { kind: 'ice-end' }
  | { kind: 'restart-request' };
