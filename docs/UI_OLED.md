# VySCSh — Interface Metro OLED (v0.2)

## Objetivo

Reduzir a interface a uma decisão inicial: **Transmitir (Host)** ou **Assistir (Cliente)**. O tema é preto OLED (`#000`), cartões retos, tipografia Segoe UI e acento verde-água; sem dependências de biblioteca de componentes.

## Tela inicial

- Tile **Transmitir** → opções mínimas de host.
- Tile **Assistir** → busca de transmissão / IP manual.
- Indicador informativo de presença de adaptador Radmin.

## Host

1. Fonte (monitor ou janela).
2. Resolução desejada: 720p, 1080p, 1440p.
3. FPS desejado: 30 ou 60.
4. Bitrate máximo: 2 a 16 Mbps.
5. Áudio do sistema opcional (beta).
6. Interface de rede em **Avançado** (preferência Radmin).
7. Iniciar → prévia, status, convite copiável e espectadores.

Os valores de resolução e FPS são solicitados à API `getDisplayMedia()` com constraints `ideal`, não `exact`; o sistema pode retornar valores diferentes. O limite de bitrate é aplicado com `RTCRtpSender.setParameters()` quando disponível. Para conferir a resolução/FPS efetivos, consulte os logs técnicos. O bitrate não é garantia de qualidade nem de throughput.

## Cliente

1. Busca automaticamente hosts via UDP na rede Radmin/LAN.
2. Seleção de host preenche IP/porta, **mas nunca a chave**.
3. Entrada manual ou convite completo `IP:porta#chave` caso o host não seja encontrado.
4. Assistir → player remoto, status e diagnósticos.

## Navegação

O botão Voltar fica desabilitado enquanto existe uma sessão iniciando/ativa; primeiro é preciso encerrar a sessão. Logs ficam recolhidos por padrão.

## Próximas melhorias

- Ajuste de qualidade em tempo real.
- Captura de áudio por aplicativo.
- Medição real de bitrate, latência ponta a ponta e codificador.
- Interface responsiva para janela pequena (o MVP continua somente Windows).
