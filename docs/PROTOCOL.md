# Protocolo WebSocket — MVP 0.1

> Todos os objetos são JSON UTF-8. **O protocolo atual é experimental** e poderá mudar até a primeira versão estável. `v: 1` ficará explícito em uma versão posterior; no momento a API discrimina por `type`.

## Autenticação

Cliente → servidor, primeira mensagem (até 10 segundos após abrir o WebSocket):

```json
{"type":"auth","role":"viewer","key":"0123456789abcdef0123456789abcdef"}
```

`role` é `host` ou `viewer`. O host fornece a mesma chave configurada ao abrir o servidor. Resposta positiva:

```json
{"type":"welcome","peerId":"<uuid ou host>","role":"viewer"}
```

O servidor aceita um host e no máximo quatro viewers, e recusa credenciais inválidas.

## Presença

Servidor → host:

```json
{"type":"viewer-joined","peerId":"<uuid>"}
```

```json
{"type":"viewer-left","peerId":"<uuid>"}
```

## Negociação

Mensagem enviada por qualquer peer; o servidor valida o destino e substitui o remetente pelo ID autenticado:

```json
{"type":"signal","to":"host","data":{"kind":"answer","sdp":"v=0..."}}
```

Servidor → destinatário:

```json
{"type":"signal","from":"<peerId>","data":{"kind":"answer","sdp":"v=0..."}}
```

`data` admite:

- `{ "kind": "offer", "sdp": "..." }`
- `{ "kind": "answer", "sdp": "..." }`
- `{ "kind": "ice", "candidate": { "candidate": "candidate:...", "sdpMid": "0", "sdpMLineIndex": 0 } }`
- `{ "kind": "ice-end" }`
- `{ "kind": "restart-request" }` (reservado)

## Controle

```json
{"type":"ping"}
```

```json
{"type":"pong"}
```

Erros não sensíveis retornam:

```json
{"type":"error","code":"PEER_OFFLINE"}
```

A validação do servidor limita tamanho das mensagens (100 KB), taxa (100 mensagens/segundo/conexão), tipos de evento, SDP e destino.

## Máquina de estados simplificada

- `idle` → `connecting` → `connected` (WebSocket autenticado)
- `connecting` → `failed` (timeout/credencial incorreta)
- `connected` → `disconnected` (WebSocket fechou)
- WebRTC: `new` → `connecting` → `connected`, com tentativa de ICE restart no host em `failed`.

**Importante:** status do WebSocket e status do WebRTC são independentes. Os estados de mídia/reprodução serão formalizados no marco M2.
