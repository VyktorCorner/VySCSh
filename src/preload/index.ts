import { contextBridge, ipcRenderer } from 'electron';
import type { ClientBridge } from '../shared/types';

const bridge: ClientBridge = {
  listAdapters: () => ipcRenderer.invoke('vyscsh:list-adapters'),
  listSources: () => ipcRenderer.invoke('vyscsh:list-sources'),
  selectCapture: (id, systemAudio) => ipcRenderer.invoke('vyscsh:select-capture', id, systemAudio),
  startHost: (options) => ipcRenderer.invoke('vyscsh:start-host', options),
  stopHost: () => ipcRenderer.invoke('vyscsh:stop-host'),
  copyText: (value) => ipcRenderer.invoke('vyscsh:copy-text', value)
};

contextBridge.exposeInMainWorld('vyscsh', bridge);
