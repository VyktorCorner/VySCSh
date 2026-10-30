# VySCSh

**Private screen sharing between Windows PCs. Built to keep things simple.**

[English](#english) | [Português (Brasil)](#português-brasil)

---

## English

VySCSh is a small screen-sharing app built for watching a friend's screen over a private network. It uses **WebRTC** for video and audio, with **Radmin VPN** handling the network connection in the current Windows build.

No streaming account, no complicated setup: one PC hosts a session, and the other joins with a room key.

### What it does

- Share a monitor or an application window.
- Watch a stream from another Windows PC.
- Choose resolution, frame rate, and bitrate.
- Optionally capture system audio (experimental).
- Find available hosts on the network or connect by IP.
- Watch in fullscreen or Picture-in-Picture.

### Screenshots

![VySCSh home screen](docs/screenshots/home.png)

![VySCSh viewer screen](docs/screenshots/client.png)

### Requirements

- Windows 10 or 11 on both PCs.
- Radmin VPN installed and connected to the same virtual network on both PCs.
- Node.js 22 or newer **only if you want to run from source or build the installer**.

### Using VySCSh

**On the host PC**

1. Open VySCSh and select **Transmitir** (Host).
2. Pick a monitor or window and set the video quality.
3. Start the stream.
4. Send the other person your Radmin IP, port, and room key.

**On the viewer PC**

1. Open VySCSh and select **Assistir** (Viewer).
2. Choose a discovered host or enter its IP manually.
3. Enter the room key and connect.

The default signaling port is **47892/TCP**. Host discovery uses **47893/UDP** and may not work on every VPN configuration. If discovery finds nothing, use the host's IP. Allow the required traffic through Windows Firewall on the Radmin network; you normally do not need router port forwarding for this setup.

### Run from source

```powershell
npm install
npm run dev
```

### Build the Windows installer

```powershell
npm install
npm run package:win
```

The installer is written to `release/`. To check the code before a build:

```powershell
npm run check
npm test
npm run build
```

### Built with

Electron, React, TypeScript, Vite, WebRTC, and WebSocket signaling.

### Current status

VySCSh is an **experimental Windows MVP**. Real-world testing across different PCs and networks is still in progress. System audio support can vary by Windows version and source application.

The app currently depends on Radmin VPN for its private network. **Android, Linux, and integration with VyLink are future goals, not available features.** See the [roadmap](ROADMAP.md) for the planned work.

Keep your room key private, and only share screens you have permission to share.

### Credits and license

Made by **VyktorCorner and Vyko**, as an independent project.

A license has not been selected yet. Until one is added, the repository should not be treated as licensed for unrestricted reuse.

---

## Português (Brasil)

O VySCSh é um aplicativo simples para compartilhar a tela com amigos em uma rede privada. Ele usa **WebRTC** para transmitir vídeo e áudio e, na versão atual para Windows, depende do **Radmin VPN** para conectar os computadores.

Sem precisar criar conta em um serviço de streaming: um computador transmite e o outro entra com a chave da sala.

### O que ele faz

- Compartilha um monitor ou uma janela de aplicativo.
- Permite assistir à transmissão de outro PC Windows.
- Oferece ajustes de resolução, FPS e bitrate.
- Permite capturar o áudio do sistema (experimental).
- Procura hosts na rede ou conecta por IP.
- Possui modo tela cheia e Picture-in-Picture.

### Capturas de tela

![Tela inicial do VySCSh](docs/screenshots/home.png)

![Tela do espectador no VySCSh](docs/screenshots/client.png)

### Requisitos

- Windows 10 ou 11 nos dois computadores.
- Radmin VPN instalado e conectado à mesma rede virtual nos dois PCs.
- Node.js 22 ou mais recente **apenas para executar pelo código-fonte ou gerar o instalador**.

### Como usar

**No computador que transmite**

1. Abra o VySCSh e selecione **Transmitir**.
2. Escolha o monitor ou a janela e ajuste a qualidade.
3. Inicie a transmissão.
4. Envie o IP do Radmin, a porta e a chave da sala para a outra pessoa.

**No computador que assiste**

1. Abra o VySCSh e selecione **Assistir**.
2. Escolha um host encontrado ou informe o IP manualmente.
3. Digite a chave da sala e conecte.

A porta padrão de sinalização é **47892/TCP**. A descoberta de hosts usa **47893/UDP** e pode não funcionar em todas as configurações de VPN. Se nenhum host aparecer, use o IP manual. Libere o tráfego necessário no Firewall do Windows para a rede do Radmin; normalmente não é preciso abrir portas no roteador nesse cenário.

### Executar pelo código-fonte

```powershell
npm install
npm run dev
```

### Gerar o instalador do Windows

```powershell
npm install
npm run package:win
```

O instalador é gerado na pasta `release/`. Para verificar o projeto antes de compilar:

```powershell
npm run check
npm test
npm run build
```

### Tecnologias

Electron, React, TypeScript, Vite, WebRTC e WebSocket para sinalização.

### Estado atual

O VySCSh ainda é um **MVP experimental para Windows**. Os testes entre diferentes computadores e redes continuam em andamento. O áudio do sistema pode variar conforme a versão do Windows e o aplicativo transmitido.

A versão atual depende do Radmin VPN. **Android, Linux e integração com o VyLink são objetivos futuros, não funcionalidades disponíveis.** Consulte o [roadmap](ROADMAP.md).

Mantenha a chave da sala em sigilo e compartilhe apenas telas que você tem autorização para transmitir.

### Créditos e licença

Feito por **VyktorCorner e Vyko**, como projeto independente.

A licença do código ainda não foi definida. Até que uma licença seja adicionada, o repositório não deve ser considerado liberado para reutilização irrestrita.
