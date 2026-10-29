# Registro de decisões de arquitetura (ADR resumido)

## ADR-001 — Windows como primeira plataforma
Decisão: Electron + React + TypeScript. Motivo: interface única para host e viewer; captura via APIs do Chromium; build NSIS. Revisitar a performance de captura após benchmarks.

## ADR-002 — Servidor embutido no computador host
Decisão: WebSocket Server `ws` em Electron main, vinculado ao endereço IPv4 da Radmin. Motivo: teste sem Proxmox, domínio ou exposição de portas do roteador. Revisitar ao implementar Proxmox e Discord OAuth2.

## ADR-003 — Mídia P2P WebRTC
Decisão: uma PeerConnection por espectador, até 4 viewers. Motivo: pouca infraestrutura, DTLS-SRTP, experiência inicial. Revisitar com SFU se o upload/encoders do host saturarem.

## ADR-004 — Segurança inicial de sala
Decisão: chave aleatória de 128 bits gerada em cada abertura do app e entregue manualmente. Motivo: evitar entrada irrestrita na rede VPN. Não é substituto para Discord OAuth2, WSS e autorização por identidade.

## ADR-005 — Radmin VPN como transporte de rede temporário
Decisão: usar apenas a interface de rede já existente; sem controlar Radmin por código. Motivo: roteador do provedor sem port forwarding disponível. Evolução: ICE/STUN automático, TURN e signaling remoto.

## ADR-006 — Audio loopback experimental
Decisão: iniciar com captura de áudio do sistema opcional por `desktopCapturer`, com opção padrão desabilitada. Motivo: variação de compatibilidade em jogos e drivers. Não prometer isolamento do áudio de aplicativo.
