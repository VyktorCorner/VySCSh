# Descoberta de hosts — UDP v1 (experimental)

## Visão geral

- **Sinalização WebSocket:** TCP `47892` no IP escolhido no Host.
- **Descoberta:** UDP `47893`, apenas no uso local/VPN; não atravessa CGNAT automaticamente.
- Cliente envia uma mensagem `search` para `255.255.255.255` e endereços de broadcast derivados das interfaces IPv4.
- Host responde para o endereço/porta de origem com seu nome de PC e a porta de sinalização.
- O host só responde a pedidos originados na sub-rede do adaptador que selecionou para a transmissão.

### Mensagens ilustrativas (JSON)

```json
{ "magic": "VySCSh:discovery", "version": 1, "kind": "search" }
```

```json
{ "magic": "VySCSh:discovery", "version": 1, "kind": "announce", "name": "MEU-PC", "port": 47892, "via": "radmin" }
```

O cliente utiliza o endereço IP **do remetente UDP** em vez de confiar em um IP declarado no pacote. O mecanismo não anuncia a chave da sala.

## Segurança e limitações

A descoberta **não é autenticação**. Membros da mesma sub-rede podem ver o nome do computador/porta e podem forjar anúncios. A entrada real continua exigindo a chave aleatória do Host. O protocolo UDP da descoberta não possui criptografia.

**Broadcast UDP pode não atravessar a Radmin VPN** em algumas topologias ou pode ser bloqueado pelo firewall do Windows. O sistema continuará oferecendo conexão por IP e chave. Mesmo quando a busca funciona, o firewall pode bloquear WebSocket/ICE, exigindo regra local apropriada.

## Passos para teste

1. Conectar os dois computadores à mesma rede Radmin.
2. Host escolher IP do adaptador Radmin e iniciar transmissão.
3. Cliente abrir a tela Assistir e observar a lista por até duas buscas.
4. Se não aparecer, testar a conexão manual pelo IP Radmin; não desativar o firewall globalmente.
5. Validar vídeo e áudio P2P, independentemente do sucesso da descoberta.
