# Plano de testes manuais — dois PCs Windows

## Ambiente

- PC A: Windows 10/11, Radmin VPN conectado à rede escolhida, VySCSh em Host.
- PC B: Windows 10/11, mesma rede Radmin, VySCSh em Viewer.
- Firewall Windows mantido habilitado.

## T1 — Sinalização

1. No host, selecione IP Radmin e porta 47892.
2. Inicie a transmissão de um monitor.
3. No viewer, conecte com IP, porta e chave.
4. Resultado esperado: viewer recebe `welcome`, host recebe evento `viewer-joined`, e WebRTC negocia.

## T2 — Vídeo/áudio

1. Compartilhe uma janela com animação ou um jogo leve.
2. Confira vídeo no viewer durante 10 minutos.
3. Refaça com áudio do sistema ativado.
4. Registre FPS percebido, travamentos, atraso e áudio, sem gravar dados privados.

## T3 — Isolamento

1. Digite chave incorreta no viewer.
2. Verifique a recusa.
3. Encerre a sessão no host; viewer deve desconectar.

## T4 — Rede

1. Verifique `ping <IP_RADMIN_HOST>` e `Test-NetConnection <IP_RADMIN_HOST> -Port 47892`.
2. Inspecione se o Radmin está em conexão direta ou relay, quando visível.
3. Se o WebSocket conecta mas não aparece vídeo, verifique ICE, mDNS e firewall.

## Checklist de diagnóstico

- [ ] Radmin instalado e conectado nos dois PCs
- [ ] IP Radmin corretamente selecionado no host
- [ ] Chave de 32 caracteres corresponde à sala
- [ ] Porta TCP 47892 não bloqueada pelo firewall local
- [ ] O host selecionou fonte e está compartilhando
- [ ] Há conexão WebSocket e sinalização
- [ ] O ICE está em `connected` (não apenas WebSocket)
- [ ] Nenhuma VPN concorrente intercepta a rota
