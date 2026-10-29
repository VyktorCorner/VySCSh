import path from 'node:path';
import { networkInterfaces, type NetworkInterfaceInfo } from 'node:os';
import { isIP } from 'node:net';
import { app, BrowserWindow, clipboard, desktopCapturer, ipcMain, session, type IpcMainInvokeEvent } from 'electron';
import { startSignaling, type RunningHost } from './signaling';
import type { AdapterInfo, CaptureSourceInfo, HostOptions } from '../shared/types';

// Only this trusted local renderer may issue privileged IPC calls.
let mainWindow: BrowserWindow | null = null;
let running: RunningHost | null = null;
let selectedCapture: { id: string; audio: boolean } | null = null;

function verifySender(event: IpcMainInvokeEvent) {
  if (!mainWindow || event.sender !== mainWindow.webContents) throw new Error('IPC sender rejected');
}
function ipv4Adapters(): AdapterInfo[] {
  const result: AdapterInfo[] = [];
  for (const [name, addresses] of Object.entries(networkInterfaces())) {
    for (const addr of (addresses ?? []) as NetworkInterfaceInfo[]) {
      if (addr.family === 'IPv4' && !addr.internal) result.push({ name, address: addr.address, radmin: /radmin/i.test(name) });
    }
  }
  return result.sort((a, b) => Number(b.radmin) - Number(a.radmin) || a.name.localeCompare(b.name));
}

function registerHandlers() {
  ipcMain.handle('vyscsh:list-adapters', (event) => { verifySender(event); return ipv4Adapters(); });
  ipcMain.handle('vyscsh:list-sources', async (event): Promise<CaptureSourceInfo[]> => {
    verifySender(event);
    const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });
    return sources.map((s) => ({ id: s.id, name: s.name, type: s.id.startsWith('screen:') ? 'screen' : 'window' }));
  });
  ipcMain.handle('vyscsh:select-capture', (event, id: unknown, audio: unknown) => {
    verifySender(event);
    if (typeof id !== 'string' || id.length > 256 || typeof audio !== 'boolean') throw new Error('Invalid capture');
    selectedCapture = { id, audio };
  });
  ipcMain.handle('vyscsh:start-host', async (event, input: HostOptions) => {
    verifySender(event);
    if (running) throw new Error('Server already running');
    if (!input || typeof input.bindIp !== 'string' || isIP(input.bindIp) !== 4 ||
        !ipv4Adapters().some((a) => a.address === input.bindIp) ||
        !Number.isInteger(input.port) || input.port < 1024 || input.port > 65535 ||
        typeof input.accessKey !== 'string' || !/^[a-f0-9]{32}$/.test(input.accessKey)) {
      throw new Error('Invalid server parameters');
    }
    running = await startSignaling(input);
    return { ip: input.bindIp, port: input.port };
  });
  ipcMain.handle('vyscsh:stop-host', async (event) => {
    verifySender(event);
    const current = running;
    running = null;
    if (current) await current.close();
  });
  ipcMain.handle('vyscsh:copy-text', (event, text: unknown) => {
    verifySender(event);
    if (typeof text !== 'string' || text.length > 200) throw new Error('Invalid clipboard data');
    clipboard.writeText(text);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1160, height: 770, minWidth: 900, minHeight: 620,
    backgroundColor: '#0e111a',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      nodeIntegration: false, contextIsolation: true, sandbox: true
    }
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());
  const devUrl = process.env.VYSC_SH_DEV_URL;
  if (devUrl) void mainWindow.loadURL(devUrl);
  else void mainWindow.loadFile(path.join(__dirname, '..', '..', 'dist-renderer', 'index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  registerHandlers();
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    // Electron supports callback(null) to deny a display capture request, but its
    // TypeScript callback signature in this version does not include null.
    const deny = () => callback(null as unknown as Parameters<typeof callback>[0]);
    if (!selectedCapture || !request.userGesture || !request.videoRequested) { deny(); return; }
    try {
      const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] });
      const source = sources.find((s) => s.id === selectedCapture?.id);
      if (!source) { deny(); return; }
      callback({ video: source, audio: selectedCapture.audio && request.audioRequested ? 'loopback' : undefined });
    } catch { deny(); }
  }, { useSystemPicker: false });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('before-quit', () => { if (running) void running.close(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

