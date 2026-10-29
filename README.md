# VySCSh

**MVP 0.1.0 — compartilhamento privado de tela entre computadores Windows via Radmin VPN + WebRTC.**

O mesmo aplicativo tem dois modos:

- **Hospedar**: escolhe janela/monitor, abre um servidor WebSocket **no próprio PC Windows** e publica mídia P2P.
- **Assistir**: informa IP Radmin do host, porta e chave temporária e recebe o vídeo/áudio.

**Não é necessário Proxmox, domínio, cloud ou abrir portas no roteador para o primeiro teste**, desde que a Radmin VPN conecte os computadores e o firewall local permita a comunicação. O Radmin é uma **dependência operacional temporária**, não uma dependência no código de captura/WebRTC.

> Status: **código-fonte de MVP experimental**. O funcionamento real em Windows/Radmin depende de validação em duas máquinas. Não confunda com release de produção.

## Requisitos

- Windows 10/11 x64 em **dois PCs**.
- Radmin VPN instalado e **mesma rede virtual Radmin** nos dois PCs.
- Node.js 22+ e npm para desenvolvimento/gerar o instalador.
- Conexão com a internet ao executar `npm install` pela primeira vez.
- Um monitor ou janela disponível para compartilhar.

## Como executar no desenvolvimento

```powershell
# Clone o repositório e entre na pasta
# git clone https://github.com/VyktorCorner/VySCSh.git
cd VySCSh
npm install
npm run dev
```

Execute os comandos nos dois computadores (ou instale o executável nos dois). **Não é necessário executar `npm run dev` no Proxmox**.

### PC A — Hospedar

1. Crie uma rede no Radmin VPN (ou entre em uma já existente).
2. Abra o VySCSh em **Hospedar transmissão**.
3. Selecione o adaptador `Radmin VPN` (ou o IPv4 virtual correto).
4. Escolha uma janela/monitor, deixe a porta `47892`, e marque o áudio do sistema se desejar testá-lo (beta).
5. Clique **Criar sala e transmitir**.
6. Compartilhe com o espectador o **IP Radmin**, a **porta** e a **chave da sala**. Não publique a chave em canais abertos.

### PC B — Assistir

1. Entre na **mesma rede Radmin** do host.
2. Abra VySCSh em **Assistir transmissão**.
3. Digite IP Radmin do PC A, porta `47892` e a chave de 32 caracteres.
4. Clique **Conectar à transmissão**.
5. Aguarde o WebRTC negociar o caminho de mídia. O player mostra vídeo e, se habilitado e disponível, áudio.

> **Firewall do Windows:** se houver bloqueio, permita o aplicativo na interface de rede Radmin; para o signaling a porta TCP é `47892`. O WebRTC usa portas UDP negociadas dinamicamente, portanto regras locais adicionais podem ser necessárias. **Não desative o firewall globalmente.** Não é necessário encaminhar TCP/47892 no roteador da operadora.

## Build Windows

```powershell
npm install
npm run check
npm test
npm run build
npm run package:win
```

O instalador NSIS será gerado em `release/`, em uma máquina Windows configurada para builds Electron. O instalador **não foi gerado nem testado neste ambiente de elaboração**.

## O que já existe no código

- React + TypeScript + Electron, com escolha de janela ou monitor.
- Hospedagem WebSocket no próprio PC, vinculada ao IPv4 selecionado.
- Identificação de adaptadores com nome Radmin.
- Chave aleatória por sala (128 bits) e até **4 espectadores**.
- Sinalização WebSocket com validação de origem e roteamento das mensagens.
- PeerConnection WebRTC por espectador; ICE host candidates pela rede Radmin.
- Transmissão de vídeo, prévia local, player remoto e estatísticas básicas.
- Captura de áudio loopback no Windows **experimental e opcional**.
- Dois reinícios ICE automáticos no host quando a conexão falha.
- Isolamento do renderer Electron: preload/IPC, `sandbox`, sem Node.js na interface.
- Testes automatizados do signaling e arquivos de CI/GitHub.

## Limitações conhecidas do MVP

1. É preciso uma rede Radmin funcionando; **não há STUN/TURN nem servidor externo neste MVP**.
2. O WebRTC pode não conseguir usar a interface virtual Radmin em algumas combinações de rede, mDNS, firewall e Electron. Teste em duas máquinas reais.
3. A chave de sala protege a entrada, mas o signaling usa `ws://` **sem TLS** sobre a rede virtual. Não use este MVP em redes não confiáveis. A mídia WebRTC é criptografada por DTLS-SRTP.
4. Não há login Discord, gravação, streaming mobile, chat nem controle remoto.
5. O áudio do Windows é **beta** e pode não funcionar para todos os jogos/aplicativos.
6. Codec e aceleração por GPU são selecionados pelo Chromium/WebRTC; **1080p60 não é garantido**.
7. A reconexão após queda do WebSocket ainda não é automática; o usuário reconecta pela interface.
8. As métricas de bitrate são básicas; taxa de bits real deverá ser medida com deltas de bytes na próxima fase.
9. O usuário deve compartilhar somente conteúdo que esteja autorizado a transmitir.

## Estrutura

```text
src/main/          Electron e servidor signaling WebSocket
src/preload/       Ponte IPC autorizada
src/renderer/      React, interface e WebRTC
src/shared/        Contratos TypeScript
tests/             Testes do signaling
docs/              Arquitetura, protocolo, segurança e roadmap
.github/           GitHub Actions e modelos de issue
```

## Próximos marcos

Veja [ROADMAP.md](ROADMAP.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) e [docs/PROTOCOL.md](docs/PROTOCOL.md).

## Segurança e licença

Consulte [SECURITY.md](SECURITY.md). **Licença de código-fonte ainda não definida pelo proprietário do repositório.** Não inclua credenciais ou senhas reais nos commits.
