# Roadmap — VySCSh

## M0 — Base Windows/Radmin (código entregue)

- [x] Estrutura React + Electron + TypeScript
- [x] Dois modos no mesmo aplicativo: host e espectador
- [x] Seleção de adaptador IPv4, com identificação Radmin pelo nome
- [x] Seleção de monitor/janela e captura via Electron
- [x] Servidor WebSocket incorporado ao host, vinculado ao IP escolhido
- [x] Chave de acesso aleatória com 128 bits
- [x] WebRTC P2P: SDP, Trickle ICE, áudio opcional e vídeo
- [x] Limite de quatro espectadores e controles de encerramento
- [x] Testes de protocolo e fluxo CI
- [ ] **Validar em dois PCs Windows reais** (pendência importante)
- [ ] Gerar e instalar pacote Windows assinado, quando aplicável

## M1 — Prova de conceito funcional (primeiros testes de campo)

- [ ] PC A e PC B conectados na mesma rede Radmin
- [ ] Verificar se a conexão TCP à porta 47892 funciona
- [ ] Validar troca `auth` / `welcome` / `offer` / `answer` / `ice`
- [ ] Confirmar áudio loopback em pelo menos dois jogos
- [ ] Verificar tráfego de vídeo P2P e seleção do candidato ICE
- [ ] Medir latência ponta a ponta, FPS e uso CPU/GPU
- [ ] Corrigir eventuais problemas mDNS/ICE com Radmin
- [ ] Testar bloqueio do Windows Firewall sem desativar a proteção

**Critério de aceite:** PC A transmite uma janela por 10 minutos sem interrupção; PC B assiste e ouve áudio quando ativado; a tecla/controle de encerrar remove o vídeo.

## M2 — Estabilidade e qualidade

- [ ] Recuperar automaticamente sinalização e sessões após desconexão
- [ ] Separar estados de signaling, peer e reprodução
- [ ] Métricas reais de bitrate, FPS, jitter e perda de pacotes
- [ ] Perfis Game Mode 1080p60 e Code Mode com foco em nitidez
- [ ] Testes com 2–4 espectadores
- [ ] Controle de bitrate por espectador e benchmark de encoder
- [ ] Captura de áudio por aplicativo, quando viável
- [ ] Tratamento de colisão SDP e renovação ICE robustos

## M3 — Rede sem VPN obrigatória

- [ ] Servidor de sinalização privado no Proxmox
- [ ] Discord OAuth2 e cargos/ACLs
- [ ] ICE com servidores STUN e negociação automática
- [ ] TURN externo para cenários com CGNAT restritivo
- [ ] Criptografar a sinalização por TLS/WSS
- [ ] Rotação/revogação de tokens de sessão
- [ ] Atualizador e versionamento do protocolo

## M4 — Distribuição e maturidade

- [ ] Instalador Windows assinado e release automatizada
- [ ] CI com teste de integração entre dois processos Electron
- [ ] Auditoria de dependências e atualização de Electron
- [ ] Benchmark em diferentes GPUs e CPUs
- [ ] Considerar SFU apenas quando a escala justificar

## Fora do escopo do MVP

- Android/iOS e integração Discord Activity
- Gravação em nuvem, controle remoto e acesso invisível
- Transcodificação ou streaming público
